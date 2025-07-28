"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Navigation from '../../components/Navigation';
import Friends from '../../components/Friends';
import ProfileAvatar from '../../components/ProfileAvatar';
import countries from '../utils/countries';
import MessageExpirySettings from '../../components/MessageExpirySettings';
import TwoFactorSettings from '../../components/TwoFactorSettings';
import ThemeToggle from '../../components/ThemeToggle';
import "./styles.css";
import { useCSRFToken } from '../../components/hooks/useCSRFToken';
import ImageUrlInput from '../../components/ImageUrlInput';

// Profile settings interfaces
interface Profile {
  profile_id: string;
  user_id: string;
  display_name: string;
  bio: string;
  profile_picture_url: string;
  visibility: string;
  ai_excluded: boolean;
  last_updated: string;
  assigned_questionnaires: Record<string, unknown>;
  completed_questionnaires: Record<string, unknown>;
}

// Questionnaire interfaces
interface Question {
  question_id: string;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  display_order: number;
  user_answer?: string;
}

interface Questionnaire {
  questionnaire_id: string;
  title: string;
  description: string;
  completed: boolean;
  questions?: Question[];
}

interface QuestionnaireGroup {
  group_id: string;
  title: string;
  description: string;
  profile_type: string;
  questionnaires: Questionnaire[];
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'questionnaires' | 'friends' | 'general'>('settings');
  const router = useRouter();
  const { protectedFetch } = useCSRFToken();
  
  // Profile settings state
  const [activeProfileTab, setActiveProfileTab] = useState<'basic' | 'love' | 'business'>('basic');
  const [basicProfile, setBasicProfile] = useState<Profile | null>(null);
  const [loveProfile, setLoveProfile] = useState<Profile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    user_id: string;
    username: string;
    email: string;
    two_factor_enabled?: boolean;
  } | null>(null);

  // Temporary form states for when profiles don't exist yet
  const [tempBasicForm, setTempBasicForm] = useState({
    display_name: '',
    bio: '',
    profile_picture_url: '',
    visibility: 'public',
    ai_excluded: false
  });
  const [tempLoveForm, setTempLoveForm] = useState({
    display_name: '',
    bio: '',
    profile_picture_url: '',
    visibility: 'public',
    ai_excluded: false
  });
  const [tempBusinessForm, setTempBusinessForm] = useState({
    display_name: '',
    bio: '',
    profile_picture_url: '',
    visibility: 'public',
    ai_excluded: false
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Questionnaire state
  const [questionnaireGroups, setQuestionnaireGroups] = useState<QuestionnaireGroup[]>([]);
  const [selectedProfileType, setSelectedProfileType] = useState<'basic' | 'business' | 'love'>('basic');
  const [questionnaireLoading, setQuestionnaireLoading] = useState(true);
  const [questionnaireError, setQuestionnaireError] = useState('');
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerVisibility, setAnswerVisibility] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Authentication check
  useEffect(() => {
    async function checkAuth() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid) {
        router.replace('/login');
      } else {
        setUserId(data.user?.user_id);
        setCurrentUser({
          user_id: data.user?.user_id,
          username: data.user?.username,
          email: data.user?.email,
          two_factor_enabled: data.user?.two_factor_enabled
        });
      }
    }
    checkAuth();
  }, [router]);

  // Profile settings logic
  function getDefaultProfile(type: 'basic' | 'love' | 'business', user_id: string): Profile {
    return {
      profile_id: uuidv4(),
      user_id,
      display_name: '',
      bio: '',
      profile_picture_url: '',
      visibility: 'public',
      ai_excluded: false,
      last_updated: new Date().toISOString(),
      assigned_questionnaires: {},
      completed_questionnaires: {},
    };
  }

  useEffect(() => {
    if (activeTab === 'settings' && userId) {
      async function fetchProfiles() {
        setProfileLoading(true);
        const [basic, love, business] = await Promise.all([
          fetch("/api/profile/basic").then(r => r.json()),
          fetch("/api/profile/love").then(r => r.json()),
          fetch("/api/profile/business").then(r => r.json()),
        ]);
        setBasicProfile(basic.profile || null);
        setLoveProfile(love.profile || null);
        setBusinessProfile(business.profile || null);
        setProfileLoading(false);
      }
      fetchProfiles();
    }
  }, [activeTab, userId]);

  const handleProfileChange = (type: 'basic' | 'love' | 'business', field: string, value: string | boolean) => {
    if (type === 'basic') {
      if (basicProfile) {
        setBasicProfile(prev => prev ? { ...prev, [field]: value } : prev);
      } else {
        setTempBasicForm(prev => ({ ...prev, [field]: value }));
      }
    }
    if (type === 'love') {
      if (loveProfile) {
        setLoveProfile(prev => prev ? { ...prev, [field]: value } : prev);
      } else {
        setTempLoveForm(prev => ({ ...prev, [field]: value }));
      }
    }
    if (type === 'business') {
      if (businessProfile) {
        setBusinessProfile(prev => prev ? { ...prev, [field]: value } : prev);
      } else {
        setTempBusinessForm(prev => ({ ...prev, [field]: value }));
      }
    }
  };

  const handleProfileSave = async (type: 'basic' | 'love' | 'business') => {
    setProfileMessage("");
    let profile: Profile | null = null;
    
    if (type === 'basic') {
      if (basicProfile) {
        profile = basicProfile;
      } else if (userId) {
        // Create profile from temp form data
        profile = {
          ...getDefaultProfile('basic', userId),
          display_name: tempBasicForm.display_name,
          bio: tempBasicForm.bio,
          profile_picture_url: tempBasicForm.profile_picture_url,
          visibility: tempBasicForm.visibility,
          ai_excluded: tempBasicForm.ai_excluded
        };
      }
    }
    if (type === 'love') {
      if (loveProfile) {
        profile = loveProfile;
      } else if (userId) {
        // Create profile from temp form data
        profile = {
          ...getDefaultProfile('love', userId),
          display_name: tempLoveForm.display_name,
          bio: tempLoveForm.bio,
          profile_picture_url: tempLoveForm.profile_picture_url,
          visibility: tempLoveForm.visibility,
          ai_excluded: tempLoveForm.ai_excluded
        };
      }
    }
    if (type === 'business') {
      if (businessProfile) {
        profile = businessProfile;
      } else if (userId) {
        // Create profile from temp form data
        profile = {
          ...getDefaultProfile('business', userId),
          display_name: tempBusinessForm.display_name,
          bio: tempBusinessForm.bio,
          profile_picture_url: tempBusinessForm.profile_picture_url,
          visibility: tempBusinessForm.visibility,
          ai_excluded: tempBusinessForm.ai_excluded
        };
      }
    }
    
    if (!profile) return;
    
    let url;
    if (type === 'basic') url = '/api/profile/basic';
    if (type === 'love') url = '/api/profile/love';
    if (type === 'business') url = '/api/profile/business';
    
    try {
      const res = await protectedFetch(url!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      
      if (data.success) {
        setProfileMessage("Profile saved!");
        // Update the actual profile state and clear temp form
        if (type === 'basic') {
          setBasicProfile(profile);
          setTempBasicForm({
            display_name: '',
            bio: '',
            profile_picture_url: '',
            visibility: 'public',
            ai_excluded: false
          });
        }
        if (type === 'love') {
          setLoveProfile(profile);
          setTempLoveForm({
            display_name: '',
            bio: '',
            profile_picture_url: '',
            visibility: 'public',
            ai_excluded: false
          });
        }
        if (type === 'business') {
          setBusinessProfile(profile);
          setTempBusinessForm({
            display_name: '',
            bio: '',
            profile_picture_url: '',
            visibility: 'public',
            ai_excluded: false
          });
        }
      } else {
        setProfileMessage(data.message || "Failed to save profile");
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileMessage("Network error occurred while saving profile");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    
    // Validation
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }
    
    if (passwordForm.oldPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from the old password');
      return;
    }
    
    setPasswordLoading(true);
    try {
      const res = await protectedFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPasswordMessage('Password changed successfully!');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(data.message || 'Failed to change password');
      }
    } catch {
      setPasswordError('An error occurred while changing password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Questionnaire logic
  const fetchQuestionnaires = useCallback(async () => {
    setQuestionnaireLoading(true);
    setQuestionnaireError('');
    try {
      const res = await fetch(`/api/questionnaires?profile_type=${selectedProfileType}`);
      const data = await res.json();
      
      if (data.success) {
        setQuestionnaireGroups(data.questionnaireGroups);
      } else {
        setQuestionnaireError(data.message || 'Failed to fetch questionnaires');
      }
    } catch {
      setQuestionnaireError('Failed to fetch questionnaires');
    } finally {
      setQuestionnaireLoading(false);
    }
  }, [selectedProfileType]);

  useEffect(() => {
    if (activeTab === 'questionnaires') {
      fetchQuestionnaires();
    }
  }, [activeTab, selectedProfileType, fetchQuestionnaires]);

  const startQuestionnaire = async (questionnaireId: string) => {
    try {
      const res = await fetch(`/api/questionnaires/${questionnaireId}`);
      const data = await res.json();
      
      if (data.success) {
        setActiveQuestionnaire(data.questionnaire);
        const initialAnswers: Record<string, string> = {};
        const initialVisibility: Record<string, string> = {};
        data.questionnaire.questions.forEach((q: Question & { user_visibility?: string }) => {
          initialAnswers[q.question_id] = q.user_answer || '';
          initialVisibility[q.question_id] = q.user_visibility || 'public';
        });
        setAnswers(initialAnswers);
        setAnswerVisibility(initialVisibility);
      } else {
        alert(data.message || 'Failed to load questionnaire');
      }
    } catch {
      alert('Failed to load questionnaire');
    }
  };

  const submitQuestionnaire = async () => {
    if (!activeQuestionnaire) return;

    setSubmitting(true);
    setSubmitMessage('');

    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        question_id: questionId,
        answer,
        visibility: answerVisibility[questionId] || 'public'
      }));

      const res = await protectedFetch(`/api/questionnaires/${activeQuestionnaire.questionnaire_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray }),
      });

      const data = await res.json();
      
      if (data.success) {
        setSubmitMessage(data.message);
        
        // Only close the form and clear answers if the questionnaire is truly completed
        const isCompleted = data.message.includes('completed successfully');
        
        if (isCompleted) {
          setTimeout(() => {
            setActiveQuestionnaire(null);
            setAnswers({});
            setAnswerVisibility({});
            setSubmitMessage('');
            fetchQuestionnaires();
          }, 1500);
        } else {
          // For partial saves, just clear the message after showing it
          setTimeout(() => {
            setSubmitMessage('');
          }, 3000);
        }
      } else {
        setSubmitMessage(data.message || 'Failed to submit questionnaire');
      }
    } catch {
      setSubmitMessage('Failed to submit questionnaire');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const renderQuestion = (question: Question) => {
    const value = answers[question.question_id] || '';
    
    switch (question.question_type) {
      case 'radio':
      case 'multiple_choice': // Keep backward compatibility
        return (
          <div className="space-y-2">
            {question.options.map((option, idx) => (
              <label key={idx} className="flex items-center">
                <input
                  type="radio"
                  name={question.question_id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                  className="mr-3"
                  required={question.is_required}
                />
                {option}
              </label>
            ))}
          </div>
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
          >
            <option value="" disabled>Select an option</option>
            {question.options.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.options.map((option, idx) => (
              <label key={idx} className="flex items-center">
                <input
                  type="checkbox"
                  value={option}
                  checked={value.includes(option)}
                  onChange={(e) => {
                    const selectedOptions = value ? value.split(',') : [];
                    if (e.target.checked) {
                      selectedOptions.push(option);
                    } else {
                      const index = selectedOptions.indexOf(option);
                      if (index > -1) selectedOptions.splice(index, 1);
                    }
                    handleAnswerChange(question.question_id, selectedOptions.join(','));
                  }}
                  className="mr-3"
                />
                {option}
              </label>
            ))}
          </div>
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors min-h-[100px] resize-vertical"
            required={question.is_required}
            placeholder="Enter your answer"
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
            placeholder="Enter a number"
          />
        );
      
      case 'year':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
            placeholder="Enter a year (e.g., 1990)"
            min="1900"
            max="2100"
          />
        );
      
      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
            placeholder="Enter your email address"
          />
        );
      
      case 'url':
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
            placeholder="Enter a URL (e.g., https://example.com)"
          />
        );
      
      case 'countryofcurrentresidence':
        return (
          <select
            value={answers[question.question_id] || ''}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
          >
            <option value="" disabled>Select your country</option>
            {countries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        );
      
      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
            required={question.is_required}
            placeholder="Enter your answer"
          />
        );
    }
  };

  // Show active questionnaire form if one is selected
  if (activeTab === 'questionnaires' && activeQuestionnaire) {
    return (
      <div className="flex h-screen bg-white dark:bg-black text-black dark:text-white">
        <Navigation currentPage="profile" />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto mt-4 sm:mt-8 md:mt-12 p-4 sm:p-6 pb-8 sm:pb-16">
            <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-4 sm:p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Questionnaire: {activeQuestionnaire.title}</h1>
                  <p className="text-gray-500 dark:text-gray-300 text-xs sm:text-sm mt-2">Complete this questionnaire: {activeQuestionnaire.description}</p>
                </div>
                <button
                  onClick={() => setActiveQuestionnaire(null)}
                  className="px-3 sm:px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-xs sm:text-sm w-full sm:w-auto"
                >
                  ← Back to List
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); submitQuestionnaire(); }} className="space-y-6">
                {activeQuestionnaire.questions?.map((question, index) => (
                  <div key={question.question_id} className="border-2 border-black dark:border-white rounded-none p-4 bg-white dark:bg-black">
                    <label className="block text-sm font-medium mb-3">
                      Question {String(index + 1)}: {question.question_text}
                      {question.is_required && <span className="text-red-400 ml-1">(Required)</span>}
                    </label>
                    {renderQuestion(question)}
                    
                    {/* Privacy Controls */}
                    <div className="mt-4 pt-4 border-t-2 border-black dark:border-white">
                      <label className="block text-xs font-medium mb-2 text-gray-500 dark:text-gray-300">
                        Answer Visibility
                      </label>
                      <select
                        value={answerVisibility[question.question_id] || 'public'}
                        onChange={(e) => setAnswerVisibility(prev => ({
                          ...prev,
                          [question.question_id]: e.target.value
                        }))}
                        className="w-full p-2 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 text-xs"
                      >
                        <option value="public">🌍 Public - Everyone can see this answer</option>
                        <option value="friends">👥 Friends Only - Only friends can see this answer</option>
                        <option value="private">🔒 Private - Hide this answer from others</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        {answerVisibility[question.question_id] === 'friends' 
                          ? 'Only users who are your friends will see this answer' 
                          : answerVisibility[question.question_id] === 'private'
                          ? 'This answer will be hidden from everyone else'
                          : 'This answer will be visible to everyone who can see your profile'}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 pt-6 border-t-2 border-black dark:border-white">
                  <button
                    type="button"
                    onClick={() => setActiveQuestionnaire(null)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none hover:bg-gray-100 dark:hover:bg-black transition-colors text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {submitting ? 'Saving...' : 'Save Progress'}
                  </button>
                </div>

                {submitMessage && (
                  <div className={`text-center mt-4 ${submitMessage.includes('success') || submitMessage.includes('Progress saved') ? 'text-green-400' : 'text-red-400'}`}>
                    {submitMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-black text-black dark:text-white">
      <Navigation currentPage="profile" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-4 md:mt-8 p-4 md:p-6 pb-8">
          <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none">
            {/* Header */}
            <div className="border-b-2 border-black dark:border-white p-3 text-center">
              <h1 className="text-xl sm:text-2xl font-bold">Profile</h1>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-col sm:flex-row border-b-2 border-black dark:border-white">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${
                  activeTab === 'settings'
                    ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white'
                    : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 border-black dark:border-white'
                }`}
              >
                Profiles
              </button>
              <button
                onClick={() => setActiveTab('general')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${
                  activeTab === 'general'
                    ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white'
                    : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 border-black dark:border-white'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('questionnaires')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${
                  activeTab === 'questionnaires'
                    ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white'
                    : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 border-black dark:border-white'
                }`}
              >
                Questionnaires
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${
                  activeTab === 'friends'
                    ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white'
                    : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black'
                }`}
              >
                Friends
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-6 md:p-8">

              {activeTab === 'settings' && (
                <div>
                  {/* Profile Type Tabs */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
                    <button 
                      className={`px-3 sm:px-4 py-2 rounded-none text-xs sm:text-sm ${activeProfileTab === 'basic' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-white dark:hover:bg-black'}`} 
                      onClick={() => setActiveProfileTab('basic')}
                    >
                      General
                    </button>
                    <button 
                      className={`px-3 sm:px-4 py-2 rounded-none text-xs sm:text-sm ${activeProfileTab === 'love' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-white dark:hover:bg-black'}`} 
                      onClick={() => setActiveProfileTab('love')}
                    >
                      Dating
                    </button>
                    <button 
                      className={`px-3 sm:px-4 py-2 rounded-none text-xs sm:text-sm ${activeProfileTab === 'business' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-white dark:hover:bg-black'}`} 
                      onClick={() => setActiveProfileTab('business')}
                    >
                      Business
                    </button>
                  </div>

                  {profileLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <>
                      {activeProfileTab === 'basic' && (basicProfile || userId) && (
                        <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            handleProfileSave('basic'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-medium mb-2">Name</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="Your display name" 
                                value={basicProfile?.display_name || tempBasicForm.display_name} 
                                onChange={e => handleProfileChange('basic', 'display_name', e.target.value)}
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Bio</label>
                              <textarea 
                                name="bio" 
                                placeholder="About you" 
                                value={basicProfile?.bio || tempBasicForm.bio} 
                                onChange={e => handleProfileChange('basic', 'bio', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                                rows={3}
                              />
                            </div>
                            <ImageUrlInput
                              label="Profile Picture URL"
                              value={basicProfile?.profile_picture_url || tempBasicForm.profile_picture_url}
                              onChange={value => handleProfileChange('basic', 'profile_picture_url', value)}
                              placeholder="Enter profile picture URL"
                              showPreview={true}
                              validateOnLoad={true}
                            />
                            {userId && (
                              <div className="flex items-center space-x-3 p-3 bg-white dark:bg-black border-2 border-black dark:border-white rounded-none">
                                <span className="text-black dark:text-white text-sm">Preview:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div>
                              <label className="text-black dark:text-white text-sm font-medium">Visibility</label>
                              <select 
                                name="visibility" 
                                value={basicProfile?.visibility || tempBasicForm.visibility} 
                                onChange={e => handleProfileChange('basic', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                              >
                                <option value="public">Public</option>
                                <option value="friends">Friends Only</option>
                                <option value="private">Private</option>
                              </select>
                            </div>
                            <div>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={basicProfile?.ai_excluded || tempBasicForm.ai_excluded}
                                  onChange={e => handleProfileChange('basic', 'ai_excluded', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-black dark:text-white text-sm font-medium">Exclude from AI</span>
                              </label>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                            >
                              {basicProfile ? 'Update' : 'Create'}
                            </button>
                          </form>
                        </div>
                      )}

                      {activeProfileTab === 'love' && (loveProfile || userId) && (
                        <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            handleProfileSave('love'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-medium mb-2">Name</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="Dating profile name" 
                                value={loveProfile?.display_name || tempLoveForm.display_name} 
                                onChange={e => handleProfileChange('love', 'display_name', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Bio</label>
                              <textarea 
                                name="bio" 
                                placeholder="Dating bio" 
                                value={loveProfile?.bio || tempLoveForm.bio} 
                                onChange={e => handleProfileChange('love', 'bio', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                                rows={3}
                              />
                            </div>
                            <ImageUrlInput
                              label="Profile Picture URL"
                              value={loveProfile?.profile_picture_url || tempLoveForm.profile_picture_url}
                              onChange={value => handleProfileChange('love', 'profile_picture_url', value)}
                              placeholder="Enter profile picture URL"
                              showPreview={true}
                              validateOnLoad={true}
                            />
                            <div>
                              <label className="text-black dark:text-white text-sm font-medium">Visibility</label>
                              <select 
                                name="visibility" 
                                value={loveProfile?.visibility || tempLoveForm.visibility} 
                                onChange={e => handleProfileChange('love', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                              >
                                <option value="public">Public</option>
                                <option value="friends">Friends Only</option>
                                <option value="private">Private</option>
                              </select>
                            </div>
                            <div>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={loveProfile?.ai_excluded || tempLoveForm.ai_excluded}
                                  onChange={e => handleProfileChange('love', 'ai_excluded', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-black dark:text-white text-sm font-medium">Exclude from AI</span>
                              </label>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                            >
                              {loveProfile ? 'Update' : 'Create'}
                            </button>
                          </form>
                        </div>
                      )}

                      {activeProfileTab === 'business' && (businessProfile || userId) && (
                        <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            handleProfileSave('business'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-medium mb-2">Name</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="Professional name" 
                                value={businessProfile?.display_name || tempBusinessForm.display_name} 
                                onChange={e => handleProfileChange('business', 'display_name', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Bio</label>
                              <textarea 
                                name="bio" 
                                placeholder="Professional bio" 
                                value={businessProfile?.bio || tempBusinessForm.bio} 
                                onChange={e => handleProfileChange('business', 'bio', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                                rows={3}
                              />
                            </div>
                            <ImageUrlInput
                              label="Profile Picture URL"
                              value={businessProfile?.profile_picture_url || tempBusinessForm.profile_picture_url}
                              onChange={value => handleProfileChange('business', 'profile_picture_url', value)}
                              placeholder="Enter profile picture URL"
                              showPreview={true}
                              validateOnLoad={true}
                            />
                            <div>
                              <label className="text-black dark:text-white text-sm font-medium">Visibility</label>
                              <select 
                                name="visibility" 
                                value={businessProfile?.visibility || tempBusinessForm.visibility} 
                                onChange={e => handleProfileChange('business', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                              >
                                <option value="public">Public</option>
                                <option value="friends">Friends Only</option>
                                <option value="private">Private</option>
                              </select>
                            </div>
                            <div>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={businessProfile?.ai_excluded || tempBusinessForm.ai_excluded}
                                  onChange={e => handleProfileChange('business', 'ai_excluded', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-black dark:text-white text-sm font-medium">Exclude from AI</span>
                              </label>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                            >
                              {businessProfile ? 'Update' : 'Create'}
                            </button>
                          </form>
                        </div>
                      )}

                      {profileMessage && (
                        <div className="text-green-400 text-center mt-4">{profileMessage}</div>
                      )}

                      {/* Message Expiry Settings */}
                      <MessageExpirySettings className="mt-8" />
                    </>
                  )}
                </div>
              )}

              {activeTab === 'questionnaires' && (
                <div>
                  {/* Profile Type Selector */}
                  <div className="flex justify-center mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-1">
                      {(['basic', 'business', 'love'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedProfileType(type)}
                          className={`px-3 sm:px-4 py-2 rounded-none transition-colors text-xs sm:text-sm ${
                            selectedProfileType === type
                              ? 'bg-black dark:bg-white text-white dark:text-black'
                              : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 sm:border-r-2 border-black dark:border-white last:border-none'
                          }`}
                        >
                          {type === 'basic' ? 'General' : type === 'business' ? 'Business' : 'Dating'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {questionnaireLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : questionnaireError ? (
                    <div className="text-center py-8 text-red-400">{questionnaireError}</div>
                  ) : questionnaireGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No questionnaires available
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {questionnaireGroups.map((group) => (
                        <div key={group.group_id} className="border-2 border-black dark:border-white rounded-none p-6 bg-white dark:bg-black">
                          <h2 className="text-xl font-bold mb-2">{group.title}</h2>
                          
                          <div className="space-y-3">
                            {group.questionnaires.map((questionnaire) => (
                              <div key={questionnaire.questionnaire_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-black border-2 border-black dark:border-white p-3 sm:p-4 rounded-none">
                                <div className="mb-3 sm:mb-0">
                                  <h3 className="font-semibold text-sm sm:text-base">{questionnaire.title}</h3>
                                </div>
                                <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto justify-end">
                                  {questionnaire.completed ? (
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                      <span className="text-green-400 text-xs sm:text-sm order-2 sm:order-1">Completed</span>
                                      <button
                                        onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                        className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-xs sm:text-sm order-1 sm:order-2"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                      className="px-3 sm:px-4 py-1 sm:py-2 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-xs sm:text-sm"
                                    >
                                      Start
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'friends' && (
                <Friends />
              )}

              {activeTab === 'general' && (
                <div className="space-y-8">
                  {/* Password Change Section */}
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                    <h2 className="text-xl font-bold mb-4">Change Password</h2>
                    <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium mb-2">Current Password</label>
                        <input 
                          type="password" 
                          placeholder="Current password" 
                          value={passwordForm.oldPassword} 
                          onChange={e => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                          className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" 
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">New Password</label>
                        <input 
                          type="password" 
                          placeholder="New password" 
                          value={passwordForm.newPassword} 
                          onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" 
                          required
                          minLength={6}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Confirm Password</label>
                        <input 
                          type="password" 
                          placeholder="Confirm password" 
                          value={passwordForm.confirmPassword} 
                          onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" 
                          required
                        />
                      </div>
                      
                      <button 
                        type="submit" 
                        disabled={passwordLoading}
                        className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </button>
                    </form>
                    
                    {/* Password change messages */}
                    {passwordError && (
                      <div className="text-red-400 text-center mt-4">{passwordError}</div>
                    )}
                    {passwordMessage && (
                      <div className="text-green-400 text-center mt-4">{passwordMessage}</div>
                    )}
                  </div>

                  {/* Two-Factor Authentication Section */}
                  <TwoFactorSettings currentUser={currentUser} />

                  {/* Theme Toggle Section */}
                  <ThemeToggle />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}