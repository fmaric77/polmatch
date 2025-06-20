"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Navigation from '../../components/Navigation';
import Friends from '../../components/Friends';
import ProfileAvatar from '../../components/ProfileAvatar';
import "./styles.css";

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
  const [activeTab, setActiveTab] = useState<'settings' | 'questionnaires' | 'friends'>('settings');
  const router = useRouter();
  
  // Profile settings state
  const [activeProfileTab, setActiveProfileTab] = useState<'basic' | 'love' | 'business'>('basic');
  const [basicProfile, setBasicProfile] = useState<Profile | null>(null);
  const [loveProfile, setLoveProfile] = useState<Profile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Questionnaire state
  const [questionnaireGroups, setQuestionnaireGroups] = useState<QuestionnaireGroup[]>([]);
  const [selectedProfileType, setSelectedProfileType] = useState<'basic' | 'business' | 'love'>('basic');
  const [questionnaireLoading, setQuestionnaireLoading] = useState(true);
  const [questionnaireError, setQuestionnaireError] = useState('');
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
    if (type === 'basic') setBasicProfile((prev) => prev ? { ...prev, [field]: value } : prev);
    if (type === 'love') setLoveProfile((prev) => prev ? { ...prev, [field]: value } : prev);
    if (type === 'business') setBusinessProfile((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleProfileSave = async (type: 'basic' | 'love' | 'business') => {
    setProfileMessage("");
    let profile: Profile | null = null;
    if (type === 'basic') profile = basicProfile;
    if (type === 'love') profile = loveProfile;
    if (type === 'business') profile = businessProfile;
    if (!profile) return;
    
    let url;
    if (type === 'basic') url = '/api/profile/basic';
    if (type === 'love') url = '/api/profile/love';
    if (type === 'business') url = '/api/profile/business';
    
    const res = await fetch(url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (data.success) setProfileMessage("Profile saved!");
    else setProfileMessage(data.message || "Failed to save profile");
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
        data.questionnaire.questions.forEach((q: Question) => {
          initialAnswers[q.question_id] = q.user_answer || '';
        });
        setAnswers(initialAnswers);
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
        answer
      }));

      const res = await fetch(`/api/questionnaires/${activeQuestionnaire.questionnaire_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray }),
      });

      const data = await res.json();
      
      if (data.success) {
        setSubmitMessage('Questionnaire completed successfully!');
        setTimeout(() => {
          setActiveQuestionnaire(null);
          setAnswers({});
          setSubmitMessage('');
          fetchQuestionnaires();
        }, 1500);
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
      case 'text':
      case 'email':
      case 'url':
        return (
          <input
            type={question.question_type}
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
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
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
            required={question.is_required}
            placeholder="Enter a number"
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            rows={4}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
            required={question.is_required}
            placeholder="Enter your detailed answer"
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
            required={question.is_required}
          >
            <option value="">Select an option</option>
            {question.options.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'radio':
        return (
          <div className="space-y-2">
            {question.options.map((option, idx) => (
              <label key={idx} className="flex items-center font-mono">
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
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.options.map((option, idx) => (
              <label key={idx} className="flex items-center font-mono">
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
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
            required={question.is_required}
            placeholder="Enter your answer"
          />
        );
    }
  };

  // Show active questionnaire form if one is selected
  if (activeTab === 'questionnaires' && activeQuestionnaire) {
    return (
      <div className="flex h-screen bg-black text-white">
        <Navigation currentPage="profile" />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto mt-4 sm:mt-8 md:mt-12 p-4 sm:p-6 pb-8 sm:pb-16">
            <div className="bg-black/80 border border-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono uppercase tracking-wider">Questionnaire: {activeQuestionnaire.title}</h1>
                  <p className="text-gray-300 font-mono text-xs sm:text-sm mt-2">Complete this questionnaire: {activeQuestionnaire.description}</p>
                </div>
                <button
                  onClick={() => setActiveQuestionnaire(null)}
                  className="px-3 sm:px-4 py-2 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider text-xs sm:text-sm w-full sm:w-auto"
                >
                  ← Back to List
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); submitQuestionnaire(); }} className="space-y-6">
                {activeQuestionnaire.questions?.map((question, index) => (
                  <div key={question.question_id} className="border border-white/30 rounded-lg p-4 bg-black/40">
                    <label className="block text-sm font-mono font-medium mb-3 uppercase tracking-wider">
                      Question {String(index + 1)}: {question.question_text}
                      {question.is_required && <span className="text-red-400 ml-1">(Required)</span>}
                    </label>
                    {renderQuestion(question)}
                  </div>
                ))}

                <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 pt-6 border-t border-white/30">
                  <button
                    type="button"
                    onClick={() => setActiveQuestionnaire(null)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-black text-white border border-white font-mono rounded hover:bg-white/10 transition-colors uppercase tracking-wider text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors disabled:opacity-50 uppercase tracking-wider text-xs sm:text-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Questionnaire'}
                  </button>
                </div>

                {submitMessage && (
                  <div className={`text-center mt-4 font-mono uppercase tracking-wider ${submitMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                    {submitMessage.includes('success') ? 'Questionnaire submitted successfully!' : 'Failed to submit questionnaire'}
                  </div>
                )}
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="profile" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-4 md:mt-8 p-4 md:p-6 pb-8">
          <div className="bg-black border-2 border-white rounded-none shadow-2xl">
            {/* Header */}
            <div className="border-b-2 border-white bg-white text-black p-3 text-center">
              <div className="font-mono text-xs mb-1 font-bold tracking-widest uppercase">Profile Settings</div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-widest uppercase">User Profile Management</h1>
              <div className="font-mono text-xs mt-1 tracking-widest uppercase">Configure Your Profiles</div>
            </div>

            {/* Tab Navigation - Made responsive with smaller text on mobile */}
            <div className="flex flex-col sm:flex-row border-b-2 border-white">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors font-mono text-xs sm:text-sm uppercase tracking-wider ${
                  activeTab === 'settings'
                    ? 'bg-white text-black border-b-2 border-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10 border-b sm:border-b-0 border-white/30'
                }`}
              >
                Profile Settings
              </button>
              <button
                onClick={() => setActiveTab('questionnaires')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors font-mono text-xs sm:text-sm uppercase tracking-wider ${
                  activeTab === 'questionnaires'
                    ? 'bg-white text-black border-b-2 border-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10 border-b sm:border-b-0 border-white/30'
                }`}
              >
                Questionnaires
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors font-mono text-xs sm:text-sm uppercase tracking-wider ${
                  activeTab === 'friends'
                    ? 'bg-white text-black border-b-2 border-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Friends
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-6 md:p-8">


              {activeTab === 'settings' && (
                <div>
                  <h1 className="text-2xl font-bold font-mono mb-6 uppercase tracking-wider">Profile Configuration</h1>
                  
                  {/* Profile Type Tabs - Made responsive */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
                    <button 
                      className={`px-3 sm:px-4 py-2 rounded font-mono text-xs sm:text-sm uppercase tracking-wider ${activeProfileTab === 'basic' ? 'bg-white text-black' : 'bg-black border border-white text-white hover:bg-white/10'}`} 
                      onClick={() => setActiveProfileTab('basic')}
                    >
                      General
                    </button>
                    <button 
                      className={`px-3 sm:px-4 py-2 rounded font-mono text-xs sm:text-sm uppercase tracking-wider ${activeProfileTab === 'love' ? 'bg-white text-black' : 'bg-black border border-white text-white hover:bg-white/10'}`} 
                      onClick={() => setActiveProfileTab('love')}
                    >
                      Dating
                    </button>
                    <button 
                      className={`px-3 sm:px-4 py-2 rounded font-mono text-xs sm:text-sm uppercase tracking-wider ${activeProfileTab === 'business' ? 'bg-white text-black' : 'bg-black border border-white text-white hover:bg-white/10'}`} 
                      onClick={() => setActiveProfileTab('business')}
                    >
                      Business
                    </button>
                  </div>

                  {profileLoading ? (
                    <div className="text-center py-8 font-mono uppercase tracking-wider">Loading profile data...</div>
                  ) : (
                    <>
                      {activeProfileTab === 'basic' && (basicProfile || userId) && (
                        <div className="bg-black/40 border border-white/30 rounded-lg p-6">
                          <h2 className="text-xl font-mono font-bold mb-4 uppercase tracking-wider">General Profile</h2>
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            if (!basicProfile && userId) setBasicProfile(getDefaultProfile('basic', userId)); 
                            handleProfileSave('basic'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Display Name</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="Enter your display name" 
                                value={basicProfile?.display_name || ''} 
                                onChange={e => handleProfileChange('basic', 'display_name', e.target.value)}
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Bio</label>
                              <textarea 
                                name="bio" 
                                placeholder="Tell us about yourself" 
                                value={basicProfile?.bio || ''} 
                                onChange={e => handleProfileChange('basic', 'bio', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                                rows={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Profile Picture URL</label>
                              <input 
                                type="text" 
                                name="profile_picture_url" 
                                placeholder="Enter image URL" 
                                value={basicProfile?.profile_picture_url || ''} 
                                onChange={e => handleProfileChange('basic', 'profile_picture_url', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            {userId && (
                              <div className="flex items-center space-x-3 mt-2 p-3 bg-black/60 border border-white/20 rounded">
                                <span className="text-white text-sm font-mono uppercase tracking-wider">Preview:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">Visibility</label>
                              <select 
                                name="visibility" 
                                value={basicProfile?.visibility || 'public'} 
                                onChange={e => handleProfileChange('basic', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                              >
                                <option value="public">Public - Everyone can see</option>
                                <option value="friends">Friends Only - Contacts can see</option>
                                <option value="private">Private - Only you can see</option>
                              </select>
                              <p className="text-gray-400 text-xs font-mono">
                                Controls who can view your profile and questionnaire responses.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={basicProfile?.ai_excluded || false}
                                  onChange={e => handleProfileChange('basic', 'ai_excluded', e.target.checked)}
                                  className="w-4 h-4 text-red-600 bg-black border-white rounded focus:ring-red-500 focus:ring-2"
                                />
                                <span className="text-white text-sm font-mono font-medium uppercase tracking-wider">Exclude from AI Analysis</span>
                              </label>
                              <p className="text-gray-400 text-xs font-mono">
                                Prevents AI from analyzing this profile for compatibility reports.
                              </p>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            >
                              {basicProfile ? 'Update' : 'Create'} General Profile
                            </button>
                          </form>
                        </div>
                      )}

                      {activeProfileTab === 'love' && (loveProfile || userId) && (
                        <div className="bg-black/40 border border-white/30 rounded-lg p-6">
                          <h2 className="text-xl font-mono font-bold mb-4 uppercase tracking-wider">Dating Profile</h2>
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            if (!loveProfile && userId) setLoveProfile(getDefaultProfile('love', userId)); 
                            handleProfileSave('love'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Display Name</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="Enter your dating profile name" 
                                value={loveProfile?.display_name || ''} 
                                onChange={e => handleProfileChange('love', 'display_name', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Dating Bio</label>
                              <textarea 
                                name="bio" 
                                placeholder="Tell potential matches about yourself" 
                                value={loveProfile?.bio || ''} 
                                onChange={e => handleProfileChange('love', 'bio', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                                rows={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Profile Picture URL</label>
                              <input 
                                type="text" 
                                name="profile_picture_url" 
                                placeholder="Enter image URL" 
                                value={loveProfile?.profile_picture_url || ''} 
                                onChange={e => handleProfileChange('love', 'profile_picture_url', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            {userId && (
                              <div className="flex items-center space-x-3 mt-2 p-3 bg-black/60 border border-white/20 rounded">
                                <span className="text-white text-sm font-mono uppercase tracking-wider">Preview:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">Visibility</label>
                              <select 
                                name="visibility" 
                                value={loveProfile?.visibility || 'public'} 
                                onChange={e => handleProfileChange('love', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                              >
                                <option value="public">Public - Everyone can see</option>
                                <option value="friends">Friends Only - Contacts can see</option>
                                <option value="private">Private - Only you can see</option>
                              </select>
                              <p className="text-gray-400 text-xs font-mono">
                                Controls who can view your dating profile and responses.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={loveProfile?.ai_excluded || false}
                                  onChange={e => handleProfileChange('love', 'ai_excluded', e.target.checked)}
                                  className="w-4 h-4 text-red-600 bg-black border-white rounded focus:ring-red-500 focus:ring-2"
                                />
                                <span className="text-white text-sm font-mono font-medium uppercase tracking-wider">Exclude from AI Analysis</span>
                              </label>
                              <p className="text-gray-400 text-xs font-mono">
                                Prevents AI from analyzing this dating profile for compatibility reports.
                              </p>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            >
                              {loveProfile ? 'Update' : 'Create'} Dating Profile
                            </button>
                          </form>
                        </div>
                      )}

                      {activeProfileTab === 'business' && (businessProfile || userId) && (
                        <div className="bg-black/40 border border-white/30 rounded-lg p-6">
                          <h2 className="text-xl font-mono font-bold mb-4 uppercase tracking-wider">Business Profile</h2>
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            if (!businessProfile && userId) setBusinessProfile(getDefaultProfile('business', userId)); 
                            handleProfileSave('business'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Professional Name</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="Enter your professional name" 
                                value={businessProfile?.display_name || ''} 
                                onChange={e => handleProfileChange('business', 'display_name', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Professional Bio</label>
                              <textarea 
                                name="bio" 
                                placeholder="Describe your professional background" 
                                value={businessProfile?.bio || ''} 
                                onChange={e => handleProfileChange('business', 'bio', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                                rows={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">Profile Picture URL</label>
                              <input 
                                type="text" 
                                name="profile_picture_url" 
                                placeholder="Enter image URL" 
                                value={businessProfile?.profile_picture_url || ''} 
                                onChange={e => handleProfileChange('business', 'profile_picture_url', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            {userId && (
                              <div className="flex items-center space-x-3 mt-2 p-3 bg-black/60 border border-white/20 rounded">
                                <span className="text-white text-sm font-mono uppercase tracking-wider">Preview:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">Visibility</label>
                              <select 
                                name="visibility" 
                                value={businessProfile?.visibility || 'public'} 
                                onChange={e => handleProfileChange('business', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                              >
                                <option value="public">Public - Everyone can see</option>
                                <option value="friends">Friends Only - Contacts can see</option>
                                <option value="private">Private - Only you can see</option>
                              </select>
                              <p className="text-gray-400 text-xs font-mono">
                                Controls who can view your business profile and responses.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={businessProfile?.ai_excluded || false}
                                  onChange={e => handleProfileChange('business', 'ai_excluded', e.target.checked)}
                                  className="w-4 h-4 text-red-600 bg-black border-white rounded focus:ring-red-500 focus:ring-2"
                                />
                                <span className="text-white text-sm font-mono font-medium uppercase tracking-wider">Exclude from AI Analysis</span>
                              </label>
                              <p className="text-gray-400 text-xs font-mono">
                                Prevents AI from analyzing this business profile for compatibility reports.
                              </p>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            >
                              {businessProfile ? 'Update' : 'Create'} Business Profile
                            </button>
                          </form>
                        </div>
                      )}

                      {profileMessage && (
                        <div className="text-green-400 text-center mt-4 font-mono uppercase tracking-wider">{profileMessage}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'questionnaires' && (
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono mb-6 text-center uppercase tracking-wider">Questionnaires</h1>
                  
                  {/* Profile Type Selector - Made responsive */}
                  <div className="flex justify-center mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row bg-black border border-white rounded-lg p-1">
                      {(['basic', 'business', 'love'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedProfileType(type)}
                          className={`px-3 sm:px-4 py-2 rounded-md transition-colors font-mono text-xs sm:text-sm uppercase tracking-wider ${
                            selectedProfileType === type
                              ? 'bg-white text-black'
                              : 'text-gray-300 hover:text-white hover:bg-white/10 border-b sm:border-b-0 sm:border-r border-gray-700 last:border-none'
                          }`}
                        >
                          {type === 'basic' ? 'General' : type === 'business' ? 'Business' : 'Dating'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {questionnaireLoading ? (
                    <div className="text-center py-8 font-mono uppercase tracking-wider">Loading questionnaires...</div>
                  ) : questionnaireError ? (
                    <div className="text-center py-8 text-red-400 font-mono uppercase tracking-wider">{questionnaireError}</div>
                  ) : questionnaireGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 font-mono uppercase tracking-wider">
                      No questionnaires available for {selectedProfileType === 'basic' ? 'General' : selectedProfileType === 'business' ? 'Business' : 'Dating'} profile
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {questionnaireGroups.map((group) => (
                        <div key={group.group_id} className="border border-white rounded-lg p-6 bg-black/40">
                          <h2 className="text-xl font-bold font-mono mb-2 uppercase tracking-wider">{group.title}</h2>
                          <p className="text-gray-300 font-mono mb-4 text-sm uppercase tracking-wider">{group.description}</p>
                          
                          <div className="space-y-3">
                            {group.questionnaires.map((questionnaire) => (
                              <div key={questionnaire.questionnaire_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/60 border border-white/30 p-3 sm:p-4 rounded-lg">
                                <div className="mb-3 sm:mb-0">
                                  <h3 className="font-semibold font-mono uppercase tracking-wider text-sm sm:text-base">{questionnaire.title}</h3>
                                  <p className="text-xs sm:text-sm text-gray-400 font-mono">{questionnaire.description}</p>
                                </div>
                                <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto justify-end">
                                  {questionnaire.completed ? (
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                      <span className="text-green-400 text-xs sm:text-sm font-mono uppercase tracking-wider order-2 sm:order-1">Completed</span>
                                      <button
                                        onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                        className="px-3 py-1 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors text-xs sm:text-sm uppercase tracking-wider order-1 sm:order-2"
                                      >
                                        Review/Edit
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                      className="px-3 sm:px-4 py-1 sm:py-2 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider text-xs sm:text-sm"
                                    >
                                      Start Questionnaire
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}