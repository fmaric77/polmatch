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
            className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
            required={question.is_required}
            placeholder="[ENTER CLASSIFICATION DATA]"
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
            placeholder="[NUMERICAL INPUT REQUIRED]"
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
            placeholder="[DETAILED INFORMATION REQUIRED]"
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
            <option value="">[SELECT CLASSIFICATION]</option>
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
            placeholder="[ENTER CLASSIFICATION DATA]"
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
          <div className="w-full max-w-4xl mx-auto mt-12 p-6 pb-16">
            <div className="bg-black/80 border border-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-bold font-mono uppercase tracking-wider">[CLASSIFIED FORM: {activeQuestionnaire.title}]</h1>
                  <p className="text-gray-300 font-mono text-sm mt-2">DOSSIER COMPLETION PROTOCOL: {activeQuestionnaire.description}</p>
                </div>
                <button
                  onClick={() => setActiveQuestionnaire(null)}
                  className="px-4 py-2 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                >
                  ← ABORT FORM
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); submitQuestionnaire(); }} className="space-y-6">
                {activeQuestionnaire.questions?.map((question, index) => (
                  <div key={question.question_id} className="border border-white/30 rounded-lg p-4 bg-black/40">
                    <label className="block text-sm font-mono font-medium mb-3 uppercase tracking-wider">
                      FIELD {String(index + 1).padStart(3, '0')}: {question.question_text}
                      {question.is_required && <span className="text-red-400 ml-1">[REQUIRED]</span>}
                    </label>
                    {renderQuestion(question)}
                  </div>
                ))}

                <div className="flex gap-4 pt-6 border-t border-white/30">
                  <button
                    type="button"
                    onClick={() => setActiveQuestionnaire(null)}
                    className="px-6 py-3 bg-black text-white border border-white font-mono rounded hover:bg-white/10 transition-colors uppercase tracking-wider"
                  >
                    TERMINATE SESSION
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors disabled:opacity-50 uppercase tracking-wider"
                  >
                    {submitting ? 'PROCESSING...' : 'COMMIT TO DATABASE'}
                  </button>
                </div>

                {submitMessage && (
                  <div className={`text-center mt-4 font-mono uppercase tracking-wider ${submitMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                    {submitMessage.includes('success') ? '[FORM SUBMISSION SUCCESSFUL]' : '[FORM SUBMISSION FAILED]'}
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
        <div className="w-full max-w-6xl mx-auto mt-12 p-6 pb-16">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg">
            {/* FBI Header */}
            <div className="border-b border-white/30 p-8">
              <h1 className="text-4xl font-bold font-mono text-center uppercase tracking-wider mb-2">
                [CLASSIFIED AGENT MANAGEMENT SYSTEM]
              </h1>
              <p className="text-center text-gray-300 font-mono text-sm uppercase tracking-wider">
                PERSONNEL FILE ADMINISTRATION / DOSSIER MANAGEMENT / CONTACT REGISTRY
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/30">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-6 py-4 text-center transition-colors font-mono uppercase tracking-wider ${
                  activeTab === 'settings'
                    ? 'bg-white text-black border-b-2 border-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                DOSSIER SETTINGS
              </button>
              <button
                onClick={() => setActiveTab('questionnaires')}
                className={`flex-1 px-6 py-4 text-center transition-colors font-mono uppercase tracking-wider ${
                  activeTab === 'questionnaires'
                    ? 'bg-white text-black border-b-2 border-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                CLASSIFICATION FORMS
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 px-6 py-4 text-center transition-colors font-mono uppercase tracking-wider ${
                  activeTab === 'friends'
                    ? 'bg-white text-black border-b-2 border-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                CONTACT REGISTRY
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-8">


              {activeTab === 'settings' && (
                <div>
                  <h1 className="text-2xl font-bold font-mono mb-6 uppercase tracking-wider">[AGENT DOSSIER CONFIGURATION]</h1>
                  
                  {/* Profile Type Tabs */}
                  <div className="flex gap-4 mb-6">
                    <button 
                      className={`px-4 py-2 rounded font-mono uppercase tracking-wider ${activeProfileTab === 'basic' ? 'bg-white text-black' : 'bg-black border border-white text-white hover:bg-white/10'}`} 
                      onClick={() => setActiveProfileTab('basic')}
                    >
                      GENERAL
                    </button>
                    <button 
                      className={`px-4 py-2 rounded font-mono uppercase tracking-wider ${activeProfileTab === 'love' ? 'bg-white text-black' : 'bg-black border border-white text-white hover:bg-white/10'}`} 
                      onClick={() => setActiveProfileTab('love')}
                    >
                      PERSONAL
                    </button>
                    <button 
                      className={`px-4 py-2 rounded font-mono uppercase tracking-wider ${activeProfileTab === 'business' ? 'bg-white text-black' : 'bg-black border border-white text-white hover:bg-white/10'}`} 
                      onClick={() => setActiveProfileTab('business')}
                    >
                      CORPORATE
                    </button>
                  </div>

                  {profileLoading ? (
                    <div className="text-center py-8 font-mono uppercase tracking-wider">[LOADING DOSSIER DATA...]</div>
                  ) : (
                    <>
                      {activeProfileTab === 'basic' && (basicProfile || userId) && (
                        <div className="bg-black/40 border border-white/30 rounded-lg p-6">
                          <h2 className="text-xl font-mono font-bold mb-4 uppercase tracking-wider">[GENERAL CLASSIFICATION FILE]</h2>
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            if (!basicProfile && userId) setBasicProfile(getDefaultProfile('basic', userId)); 
                            handleProfileSave('basic'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">AGENT DESIGNATION</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="[ENTER CODENAME]" 
                                value={basicProfile?.display_name || ''} 
                                onChange={e => handleProfileChange('basic', 'display_name', e.target.value)}
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">BIOGRAPHICAL DATA</label>
                              <textarea 
                                name="bio" 
                                placeholder="[CLASSIFIED BACKGROUND INFORMATION]" 
                                value={basicProfile?.bio || ''} 
                                onChange={e => handleProfileChange('basic', 'bio', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                                rows={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">PHOTOGRAPH URL</label>
                              <input 
                                type="text" 
                                name="profile_picture_url" 
                                placeholder="[SECURE IMAGE LOCATION]" 
                                value={basicProfile?.profile_picture_url || ''} 
                                onChange={e => handleProfileChange('basic', 'profile_picture_url', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            {userId && (
                              <div className="flex items-center space-x-3 mt-2 p-3 bg-black/60 border border-white/20 rounded">
                                <span className="text-white text-sm font-mono uppercase tracking-wider">FILE PREVIEW:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">SECURITY CLEARANCE LEVEL</label>
                              <select 
                                name="visibility" 
                                value={basicProfile?.visibility || 'public'} 
                                onChange={e => handleProfileChange('basic', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                              >
                                <option value="public">PUBLIC - UNCLASSIFIED ACCESS</option>
                                <option value="friends">RESTRICTED - CONTACT ACCESS ONLY</option>
                                <option value="private">CLASSIFIED - AGENT ACCESS ONLY</option>
                              </select>
                              <p className="text-gray-400 text-xs font-mono">
                                DETERMINES PERSONNEL FILE VISIBILITY AND FORM ACCESS AUTHORIZATION.
                              </p>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            >
                              {basicProfile ? 'UPDATE' : 'CREATE'} GENERAL FILE
                            </button>
                          </form>
                        </div>
                      )}

                      {activeProfileTab === 'love' && (loveProfile || userId) && (
                        <div className="bg-black/40 border border-white/30 rounded-lg p-6">
                          <h2 className="text-xl font-mono font-bold mb-4 uppercase tracking-wider">[PERSONAL CLASSIFICATION FILE]</h2>
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            if (!loveProfile && userId) setLoveProfile(getDefaultProfile('love', userId)); 
                            handleProfileSave('love'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">AGENT DESIGNATION</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="[ENTER PERSONAL CODENAME]" 
                                value={loveProfile?.display_name || ''} 
                                onChange={e => handleProfileChange('love', 'display_name', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">PERSONAL PROFILE DATA</label>
                              <textarea 
                                name="bio" 
                                placeholder="[PERSONAL BACKGROUND INFORMATION]" 
                                value={loveProfile?.bio || ''} 
                                onChange={e => handleProfileChange('love', 'bio', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                                rows={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">PHOTOGRAPH URL</label>
                              <input 
                                type="text" 
                                name="profile_picture_url" 
                                placeholder="[SECURE IMAGE LOCATION]" 
                                value={loveProfile?.profile_picture_url || ''} 
                                onChange={e => handleProfileChange('love', 'profile_picture_url', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            {userId && (
                              <div className="flex items-center space-x-3 mt-2 p-3 bg-black/60 border border-white/20 rounded">
                                <span className="text-white text-sm font-mono uppercase tracking-wider">FILE PREVIEW:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">SECURITY CLEARANCE LEVEL</label>
                              <select 
                                name="visibility" 
                                value={loveProfile?.visibility || 'public'} 
                                onChange={e => handleProfileChange('love', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                              >
                                <option value="public">PUBLIC - UNCLASSIFIED ACCESS</option>
                                <option value="friends">RESTRICTED - CONTACT ACCESS ONLY</option>
                                <option value="private">CLASSIFIED - AGENT ACCESS ONLY</option>
                              </select>
                              <p className="text-gray-400 text-xs font-mono">
                                DETERMINES PERSONAL FILE VISIBILITY AND RELATIONSHIP FORM ACCESS.
                              </p>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            >
                              {loveProfile ? 'UPDATE' : 'CREATE'} PERSONAL FILE
                            </button>
                          </form>
                        </div>
                      )}

                      {activeProfileTab === 'business' && (businessProfile || userId) && (
                        <div className="bg-black/40 border border-white/30 rounded-lg p-6">
                          <h2 className="text-xl font-mono font-bold mb-4 uppercase tracking-wider">[CORPORATE CLASSIFICATION FILE]</h2>
                          <form onSubmit={e => { 
                            e.preventDefault(); 
                            if (!businessProfile && userId) setBusinessProfile(getDefaultProfile('business', userId)); 
                            handleProfileSave('business'); 
                          }} className="flex flex-col gap-4 max-w-md">
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">CORPORATE DESIGNATION</label>
                              <input 
                                type="text" 
                                name="display_name" 
                                placeholder="[ENTER PROFESSIONAL CODENAME]" 
                                value={businessProfile?.display_name || ''} 
                                onChange={e => handleProfileChange('business', 'display_name', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">CORPORATE PROFILE DATA</label>
                              <textarea 
                                name="bio" 
                                placeholder="[PROFESSIONAL BACKGROUND INFORMATION]" 
                                value={businessProfile?.bio || ''} 
                                onChange={e => handleProfileChange('business', 'bio', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                                rows={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-mono font-medium mb-2 uppercase tracking-wider">PHOTOGRAPH URL</label>
                              <input 
                                type="text" 
                                name="profile_picture_url" 
                                placeholder="[SECURE IMAGE LOCATION]" 
                                value={businessProfile?.profile_picture_url || ''} 
                                onChange={e => handleProfileChange('business', 'profile_picture_url', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono" 
                              />
                            </div>
                            {userId && (
                              <div className="flex items-center space-x-3 mt-2 p-3 bg-black/60 border border-white/20 rounded">
                                <span className="text-white text-sm font-mono uppercase tracking-wider">FILE PREVIEW:</span>
                                <ProfileAvatar userId={userId} size={48} />
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">SECURITY CLEARANCE LEVEL</label>
                              <select 
                                name="visibility" 
                                value={businessProfile?.visibility || 'public'} 
                                onChange={e => handleProfileChange('business', 'visibility', e.target.value)} 
                                className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono"
                              >
                                <option value="public">PUBLIC - UNCLASSIFIED ACCESS</option>
                                <option value="friends">RESTRICTED - CONTACT ACCESS ONLY</option>
                                <option value="private">CLASSIFIED - AGENT ACCESS ONLY</option>
                              </select>
                              <p className="text-gray-400 text-xs font-mono">
                                DETERMINES CORPORATE FILE VISIBILITY AND PROFESSIONAL FORM ACCESS.
                              </p>
                            </div>
                            <button 
                              type="submit" 
                              className="p-3 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            >
                              {businessProfile ? 'UPDATE' : 'CREATE'} CORPORATE FILE
                            </button>
                          </form>
                        </div>
                      )}

                      {profileMessage && (
                        <div className="text-green-400 text-center mt-4 font-mono uppercase tracking-wider">[{profileMessage.toUpperCase()}]</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'questionnaires' && (
                <div>
                  <h1 className="text-3xl font-bold font-mono mb-6 text-center uppercase tracking-wider">[CLASSIFICATION FORM DATABASE]</h1>
                  
                  {/* Profile Type Selector */}
                  <div className="flex justify-center mb-8">
                    <div className="flex bg-black border border-white rounded-lg p-1">
                      {(['basic', 'business', 'love'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedProfileType(type)}
                          className={`px-4 py-2 rounded-md transition-colors font-mono uppercase tracking-wider ${
                            selectedProfileType === type
                              ? 'bg-white text-black'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {type === 'basic' ? 'GENERAL' : type === 'business' ? 'CORPORATE' : 'PERSONAL'} FILE
                        </button>
                      ))}
                    </div>
                  </div>

                  {questionnaireLoading ? (
                    <div className="text-center py-8 font-mono uppercase tracking-wider">[LOADING CLASSIFICATION FORMS...]</div>
                  ) : questionnaireError ? (
                    <div className="text-center py-8 text-red-400 font-mono uppercase tracking-wider">[{questionnaireError.toUpperCase()}]</div>
                  ) : questionnaireGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 font-mono uppercase tracking-wider">
                      [NO CLASSIFICATION FORMS AVAILABLE FOR {selectedProfileType === 'basic' ? 'GENERAL' : selectedProfileType === 'business' ? 'CORPORATE' : 'PERSONAL'} FILE]
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {questionnaireGroups.map((group) => (
                        <div key={group.group_id} className="border border-white rounded-lg p-6 bg-black/40">
                          <h2 className="text-xl font-bold font-mono mb-2 uppercase tracking-wider">[{group.title}]</h2>
                          <p className="text-gray-300 font-mono mb-4 text-sm uppercase tracking-wider">CLASSIFICATION: {group.description}</p>
                          
                          <div className="space-y-3">
                            {group.questionnaires.map((questionnaire) => (
                              <div key={questionnaire.questionnaire_id} className="flex justify-between items-center bg-black/60 border border-white/30 p-4 rounded-lg">
                                <div>
                                  <h3 className="font-semibold font-mono uppercase tracking-wider">{questionnaire.title}</h3>
                                  <p className="text-sm text-gray-400 font-mono">{questionnaire.description}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {questionnaire.completed ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-green-400 text-sm font-mono uppercase tracking-wider">[COMPLETED]</span>
                                      <button
                                        onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                        className="px-3 py-1 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors text-sm uppercase tracking-wider"
                                      >
                                        REVIEW/EDIT
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startQuestionnaire(questionnaire.questionnaire_id)}
                                      className="px-4 py-2 bg-white text-black font-mono rounded hover:bg-gray-200 transition-colors uppercase tracking-wider"
                                    >
                                      INITIATE FORM
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