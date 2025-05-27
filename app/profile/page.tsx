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

  const handleProfileChange = (type: 'basic' | 'love' | 'business', field: string, value: string) => {
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
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
            required={question.is_required}
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
            required={question.is_required}
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            rows={4}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
            required={question.is_required}
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
            required={question.is_required}
          >
            <option value="">Select an option...</option>
            {question.options.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'radio':
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
                  className="mr-2"
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
                  className="mr-2"
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
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
            required={question.is_required}
          />
        );
    }
  };

  // Show active questionnaire form if one is selected
  if (activeTab === 'questionnaires' && activeQuestionnaire) {
    return (
      <div className="flex h-screen bg-black text-white">
        <Navigation currentPage="profile" />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="w-full max-w-4xl mx-auto mt-12 p-6">
            <div className="bg-black/80 border border-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-bold">{activeQuestionnaire.title}</h1>
                  <p className="text-gray-300">{activeQuestionnaire.description}</p>
                </div>
                <button
                  onClick={() => setActiveQuestionnaire(null)}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  ← Back to Profile
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); submitQuestionnaire(); }} className="space-y-6">
                {activeQuestionnaire.questions?.map((question, index) => (
                  <div key={question.question_id} className="border border-gray-600 rounded-lg p-4">
                    <label className="block text-sm font-medium mb-3">
                      {index + 1}. {question.question_text}
                      {question.is_required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {renderQuestion(question)}
                  </div>
                ))}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveQuestionnaire(null)}
                    className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Questionnaire'}
                  </button>
                </div>

                {submitMessage && (
                  <div className={`text-center mt-4 ${submitMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
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
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="profile" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full max-w-6xl mx-auto mt-12 p-6">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-600">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Profile Settings
              </button>
              <button
                onClick={() => setActiveTab('questionnaires')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'questionnaires'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Questionnaires
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeTab === 'friends'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Friends
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-8">


              {activeTab === 'settings' && (
                <div>
                  <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
                  
                  {/* Profile Type Tabs */}
                  <div className="flex gap-4 mb-6">
                    <button 
                      className={`px-4 py-2 rounded ${activeProfileTab === 'basic' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`} 
                      onClick={() => setActiveProfileTab('basic')}
                    >
                      Basic
                    </button>
                    <button 
                      className={`px-4 py-2 rounded ${activeProfileTab === 'love' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`} 
                      onClick={() => setActiveProfileTab('love')}
                    >
                      Love
                    </button>
                    <button 
                      className={`px-4 py-2 rounded ${activeProfileTab === 'business' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`} 
                      onClick={() => setActiveProfileTab('business')}
                    >
                      Business
                    </button>
                  </div>

                  {profileLoading ? (
                    <div className="text-center py-8">Loading profiles...</div>
                  ) : (
                    <>
                      {activeProfileTab === 'basic' && (basicProfile || userId) && (
                        <form onSubmit={e => { 
                          e.preventDefault(); 
                          if (!basicProfile && userId) setBasicProfile(getDefaultProfile('basic', userId)); 
                          handleProfileSave('basic'); 
                        }} className="flex flex-col gap-4 max-w-md">
                          <input 
                            type="text" 
                            name="display_name" 
                            placeholder="Display Name" 
                            value={basicProfile?.display_name || ''} 
                            onChange={e => handleProfileChange('basic', 'display_name', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          <textarea 
                            name="bio" 
                            placeholder="Bio" 
                            value={basicProfile?.bio || ''} 
                            onChange={e => handleProfileChange('basic', 'bio', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          <input 
                            type="text" 
                            name="profile_picture_url" 
                            placeholder="Profile Picture URL" 
                            value={basicProfile?.profile_picture_url || ''} 
                            onChange={e => handleProfileChange('basic', 'profile_picture_url', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          {userId && (
                            <div className="flex items-center space-x-3 mt-2">
                              <span className="text-white text-sm">Preview:</span>
                              <ProfileAvatar userId={userId} size={48} />
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-white text-sm font-medium">Profile Visibility</label>
                            <select 
                              name="visibility" 
                              value={basicProfile?.visibility || 'public'} 
                              onChange={e => handleProfileChange('basic', 'visibility', e.target.value)} 
                              className="p-2 bg-black text-white border border-white rounded focus:outline-none w-full"
                            >
                              <option value="public">Public - Visible to everyone</option>
                              <option value="friends">Friends Only - Visible only to your friends</option>
                              <option value="private">Private - Visible only to you</option>
                            </select>
                            <p className="text-gray-400 text-xs">
                              Choose who can see your basic profile information and questionnaire answers.
                            </p>
                          </div>
                          <button 
                            type="submit" 
                            className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                          >
                            {basicProfile ? 'Save' : 'Create'} Basic Profile
                          </button>
                        </form>
                      )}

                      {activeProfileTab === 'love' && (loveProfile || userId) && (
                        <form onSubmit={e => { 
                          e.preventDefault(); 
                          if (!loveProfile && userId) setLoveProfile(getDefaultProfile('love', userId)); 
                          handleProfileSave('love'); 
                        }} className="flex flex-col gap-4 max-w-md">
                          <input 
                            type="text" 
                            name="display_name" 
                            placeholder="Display Name" 
                            value={loveProfile?.display_name || ''} 
                            onChange={e => handleProfileChange('love', 'display_name', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          <textarea 
                            name="bio" 
                            placeholder="Bio" 
                            value={loveProfile?.bio || ''} 
                            onChange={e => handleProfileChange('love', 'bio', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          <input 
                            type="text" 
                            name="profile_picture_url" 
                            placeholder="Profile Picture URL" 
                            value={loveProfile?.profile_picture_url || ''} 
                            onChange={e => handleProfileChange('love', 'profile_picture_url', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          {userId && (
                            <div className="flex items-center space-x-3 mt-2">
                              <span className="text-white text-sm">Preview:</span>
                              <ProfileAvatar userId={userId} size={48} />
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-white text-sm font-medium">Profile Visibility</label>
                            <select 
                              name="visibility" 
                              value={loveProfile?.visibility || 'public'} 
                              onChange={e => handleProfileChange('love', 'visibility', e.target.value)} 
                              className="p-2 bg-black text-white border border-white rounded focus:outline-none w-full"
                            >
                              <option value="public">Public - Visible to everyone</option>
                              <option value="friends">Friends Only - Visible only to your friends</option>
                              <option value="private">Private - Visible only to you</option>
                            </select>
                            <p className="text-gray-400 text-xs">
                              Choose who can see your love profile information and relationship questionnaires.
                            </p>
                          </div>
                          <button 
                            type="submit" 
                            className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                          >
                            {loveProfile ? 'Save' : 'Create'} Love Profile
                          </button>
                        </form>
                      )}

                      {activeProfileTab === 'business' && (businessProfile || userId) && (
                        <form onSubmit={e => { 
                          e.preventDefault(); 
                          if (!businessProfile && userId) setBusinessProfile(getDefaultProfile('business', userId)); 
                          handleProfileSave('business'); 
                        }} className="flex flex-col gap-4 max-w-md">
                          <input 
                            type="text" 
                            name="display_name" 
                            placeholder="Display Name" 
                            value={businessProfile?.display_name || ''} 
                            onChange={e => handleProfileChange('business', 'display_name', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          <textarea 
                            name="bio" 
                            placeholder="Bio" 
                            value={businessProfile?.bio || ''} 
                            onChange={e => handleProfileChange('business', 'bio', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          <input 
                            type="text" 
                            name="profile_picture_url" 
                            placeholder="Profile Picture URL" 
                            value={businessProfile?.profile_picture_url || ''} 
                            onChange={e => handleProfileChange('business', 'profile_picture_url', e.target.value)} 
                            className="p-2 bg-black text-white border border-white rounded focus:outline-none" 
                          />
                          {userId && (
                            <div className="flex items-center space-x-3 mt-2">
                              <span className="text-white text-sm">Preview:</span>
                              <ProfileAvatar userId={userId} size={48} />
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-white text-sm font-medium">Profile Visibility</label>
                            <select 
                              name="visibility" 
                              value={businessProfile?.visibility || 'public'} 
                              onChange={e => handleProfileChange('business', 'visibility', e.target.value)} 
                              className="p-2 bg-black text-white border border-white rounded focus:outline-none w-full"
                            >
                              <option value="public">Public - Visible to everyone</option>
                              <option value="friends">Friends Only - Visible only to your friends</option>
                              <option value="private">Private - Visible only to you</option>
                            </select>
                            <p className="text-gray-400 text-xs">
                              Choose who can see your business profile information and professional questionnaires.
                            </p>
                          </div>
                          <button 
                            type="submit" 
                            className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                          >
                            {businessProfile ? 'Save' : 'Create'} Business Profile
                          </button>
                        </form>
                      )}

                      {profileMessage && (
                        <div className="text-green-400 text-center mt-4">{profileMessage}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'questionnaires' && (
                <div>
                  <h1 className="text-3xl font-bold mb-6 text-center">Questionnaires</h1>
                  
                  {/* Profile Type Selector */}
                  <div className="flex justify-center mb-8">
                    <div className="flex bg-gray-800 rounded-lg p-1">
                      {(['basic', 'business', 'love'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedProfileType(type)}
                          className={`px-4 py-2 rounded-md transition-colors capitalize ${
                            selectedProfileType === type
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:text-white hover:bg-gray-700'
                          }`}
                        >
                          {type} Profile
                        </button>
                      ))}
                    </div>
                  </div>

                  {questionnaireLoading ? (
                    <div className="text-center py-8">Loading questionnaires...</div>
                  ) : questionnaireError ? (
                    <div className="text-center py-8 text-red-400">{questionnaireError}</div>
                  ) : questionnaireGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No questionnaires available for {selectedProfileType} profile.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {questionnaireGroups.map((group) => (
                        <div key={group.group_id} className="border border-white rounded-lg p-6">
                          <h2 className="text-xl font-bold mb-2">{group.title}</h2>
                          <p className="text-gray-300 mb-4">{group.description}</p>
                          
                          <div className="space-y-3">
                            {group.questionnaires.map((questionnaire) => (
                              <div key={questionnaire.questionnaire_id} className="flex justify-between items-center bg-gray-900 p-4 rounded-lg">
                                <div>
                                  <h3 className="font-semibold">{questionnaire.title}</h3>
                                  <p className="text-sm text-gray-400">{questionnaire.description}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {questionnaire.completed ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-green-400 text-sm">✓ Completed</span>
                                      <button
                                        onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                                      >
                                        Review/Edit
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}