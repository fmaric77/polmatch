"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Friends from '../../components/Friends';
import ProfileAvatar from '../../components/ProfileAvatar';
import MessageExpirySettings from '../../components/MessageExpirySettings';
import TwoFactorSettings from '../../components/TwoFactorSettings';
import ThemeToggle from '../../components/ThemeToggle';
import "./styles.css";
import { useCSRFToken } from '../../components/hooks/useCSRFToken';
import ImageUrlInput from '../../components/ImageUrlInput';
import Navigation from '../../components/Navigation';

interface Profile {
  profile_id: string;
  user_id: string;
  display_name: string;
  bio: string;
  profile_picture_url: string;
  visibility: 'public' | 'friends' | 'private';
  ai_excluded: boolean;
  last_updated: string;
  assigned_questionnaires: Record<string, unknown>;
  completed_questionnaires: Record<string, unknown>;
}

interface Question {
  question_id: string;
  question_text: string;
  question_type: 'text' | 'select';
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
  questionnaires: Questionnaire[];
}

export default function ProfilePage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'settings' | 'questionnaires' | 'friends' | 'general'>('settings');
  const router = useRouter();
  const { protectedFetch } = useCSRFToken();

  // no chat sidebar on profile; use global Navigation like frontpage

  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string; email: string; two_factor_enabled?: boolean; is_admin?: boolean } | null>(null);

  useEffect(() => {
    async function checkAuth(): Promise<void> {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid) {
        router.replace('/login');
      } else {
        setUserId(data.user?.user_id as string);
        setCurrentUser({
          user_id: data.user?.user_id as string,
          username: data.user?.username as string,
          email: data.user?.email as string,
          two_factor_enabled: data.user?.two_factor_enabled as boolean | undefined,
          is_admin: data.user?.is_admin as boolean | undefined
        });
      }
    }
    checkAuth();
  }, [router]);

  const [activeProfileTab, setActiveProfileTab] = useState<'basic' | 'love' | 'business'>('basic');
  const [basicProfile, setBasicProfile] = useState<Profile | null>(null);
  const [loveProfile, setLoveProfile] = useState<Profile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");

  const [tempBasicForm, setTempBasicForm] = useState({ display_name: '', bio: '', profile_picture_url: '', visibility: 'public' as Profile['visibility'], ai_excluded: false });
  const [tempLoveForm, setTempLoveForm] = useState({ display_name: '', bio: '', profile_picture_url: '', visibility: 'public' as Profile['visibility'], ai_excluded: false });
  const [tempBusinessForm, setTempBusinessForm] = useState({ display_name: '', bio: '', profile_picture_url: '', visibility: 'public' as Profile['visibility'], ai_excluded: false });

  useEffect(() => {
    if (activeTab === 'settings' && userId) {
      (async () => {
        setProfileLoading(true);
        try {
          const [basic, love, business] = await Promise.all([
            fetch('/api/profile/basic').then(r => r.json()),
            fetch('/api/profile/love').then(r => r.json()),
            fetch('/api/profile/business').then(r => r.json()),
          ]);
          setBasicProfile(basic.profile ?? null);
          setLoveProfile(love.profile ?? null);
          setBusinessProfile(business.profile ?? null);
        } catch {
          // noop
        } finally {
          setProfileLoading(false);
        }
      })();
    }
  }, [activeTab, userId]);

  const handleProfileChange = (type: 'basic' | 'love' | 'business', field: keyof Profile | 'visibility', value: string | boolean): void => {
    if (type === 'basic') {
      if (basicProfile) setBasicProfile(prev => prev ? { ...prev, [field]: value } as Profile : prev);
      else setTempBasicForm(prev => ({ ...prev, [field]: value } as typeof prev));
    } else if (type === 'love') {
      if (loveProfile) setLoveProfile(prev => prev ? { ...prev, [field]: value } as Profile : prev);
      else setTempLoveForm(prev => ({ ...prev, [field]: value } as typeof prev));
    } else {
      if (businessProfile) setBusinessProfile(prev => prev ? { ...prev, [field]: value } as Profile : prev);
      else setTempBusinessForm(prev => ({ ...prev, [field]: value } as typeof prev));
    }
  };

  const handleProfileSave = async (type: 'basic' | 'love' | 'business'): Promise<void> => {
    if (!userId) return;
    const existing = type === 'basic' ? basicProfile : type === 'love' ? loveProfile : businessProfile;
    const temp = type === 'basic' ? tempBasicForm : type === 'love' ? tempLoveForm : tempBusinessForm;
    const payload: Profile = existing ?? {
      profile_id: uuidv4(),
      user_id: userId,
      display_name: '',
      bio: '',
      profile_picture_url: '',
      visibility: 'public',
      ai_excluded: false,
      last_updated: new Date().toISOString(),
      assigned_questionnaires: {},
      completed_questionnaires: {},
    };
    const merged: Profile = { ...payload, ...temp } as Profile;

    const url = `/api/profile/${type}`;
    const method = existing ? 'PUT' : 'POST';
    const res = await protectedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
    if (res.ok) {
      setProfileMessage('Saved');
      if (type === 'basic') setBasicProfile(merged);
      if (type === 'love') setLoveProfile(merged);
      if (type === 'business') setBusinessProfile(merged);
      setTimeout(() => setProfileMessage(''), 1500);
    }
  };

  const [questionnaireGroups, setQuestionnaireGroups] = useState<QuestionnaireGroup[]>([]);
  const [selectedProfileType, setSelectedProfileType] = useState<'basic' | 'business' | 'love'>('basic');
  const [questionnaireLoading, setQuestionnaireLoading] = useState(true);
  const [questionnaireError, setQuestionnaireError] = useState('');
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    if (activeTab === 'questionnaires') {
      (async () => {
        setQuestionnaireLoading(true);
        setQuestionnaireError('');
        try {
          const res = await fetch(`/api/questionnaires?profile_type=${selectedProfileType}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message ?? 'Failed to load questionnaires');
          const groups = Array.isArray(data?.groups) ? (data.groups as QuestionnaireGroup[]) : [];
          setQuestionnaireGroups(groups);
        } catch (e) {
          setQuestionnaireError((e as Error).message);
        } finally {
          setQuestionnaireLoading(false);
        }
      })();
    }
  }, [activeTab, selectedProfileType]);

  const startQuestionnaire = (id: string): void => {
    const q = questionnaireGroups.flatMap(g => g.questionnaires).find(q => q.questionnaire_id === id) || null;
    setActiveQuestionnaire(q);
    setAnswers({});
    setSubmitMessage('');
  };

  const handleQuestionnaireSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!activeQuestionnaire) return;
    setSubmitting(true);
    try {
      const res = await protectedFetch(`/api/questionnaires/${activeQuestionnaire.questionnaire_id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      if (!res.ok) throw new Error('Failed to save');
      setSubmitMessage('Progress saved successfully');
      setActiveQuestionnaire(null);
    } catch (err) {
      setSubmitMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await protectedFetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm)
      });
      if (!res.ok) throw new Error('Failed to update password');
      setPasswordMessage('Password updated');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="w-full bg-black text-white">
      <div className="flex h-screen">
  {/* Left app sidebar - use same Navigation as frontpage */}
  <Navigation currentPage="profile" />
        {/* Main content area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white dark:bg-black text-black dark:text-white border-2 border-white rounded-lg shadow w-full overflow-hidden">
              <div className="border-b-2 border-black dark:border-white p-3">
                <h1 className="text-xl sm:text-2xl font-bold">Profile</h1>
              </div>
              <div className="flex flex-col sm:flex-row border-b-2 border-black dark:border-white">
                <button onClick={() => setActiveTab('settings')} className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${activeTab === 'settings' ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 border-black dark:border-white'}`}>Profiles</button>
                <button onClick={() => setActiveTab('general')} className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${activeTab === 'general' ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 border-black dark:border-white'}`}>Settings</button>
                <button onClick={() => setActiveTab('questionnaires')} className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${activeTab === 'questionnaires' ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 border-black dark:border-white'}`}>Questionnaires</button>
                <button onClick={() => setActiveTab('friends')} className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors text-xs sm:text-sm ${activeTab === 'friends' ? 'bg-black dark:bg-white text-white dark:text-black border-b-2 border-black dark:border-white' : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black'}`}>Friends</button>
              </div>

              <div className="p-4 sm:p-6 md:p-8">
                {activeTab === 'settings' && (
                  <div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
                      <button className={`px-3 sm:px-4 py-2 rounded-none text-xs sm:text-sm ${activeProfileTab === 'basic' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-white dark:hover:bg-black'}`} onClick={() => setActiveProfileTab('basic')}>General</button>
                      <button className={`px-3 sm:px-4 py-2 rounded-none text-xs sm:text-sm ${activeProfileTab === 'love' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-white dark:hover:bg-black'}`} onClick={() => setActiveProfileTab('love')}>Dating</button>
                      <button className={`px-3 sm:px-4 py-2 rounded-none text-xs sm:text-sm ${activeProfileTab === 'business' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white hover:bg-white dark:hover:bg-black'}`} onClick={() => setActiveProfileTab('business')}>Business</button>
                    </div>
                    {profileLoading ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : (
                      <>
                        {activeProfileTab === 'basic' && (basicProfile || userId) && (
                          <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                            <form onSubmit={(e) => { e.preventDefault(); void handleProfileSave('basic'); }} className="flex flex-col gap-4 max-w-md">
                              <div>
                                <label className="block text-sm font-medium mb-2">Name</label>
                                <input type="text" name="display_name" placeholder="Your display name" value={basicProfile?.display_name ?? tempBasicForm.display_name} onChange={e => handleProfileChange('basic', 'display_name', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Bio</label>
                                <textarea name="bio" placeholder="About you" value={basicProfile?.bio ?? tempBasicForm.bio} onChange={e => handleProfileChange('basic', 'bio', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" rows={3} />
                              </div>
                              <ImageUrlInput label="Profile Picture URL" value={basicProfile?.profile_picture_url ?? tempBasicForm.profile_picture_url} onChange={value => handleProfileChange('basic', 'profile_picture_url', value)} placeholder="Enter profile picture URL" showPreview={true} validateOnLoad={true} />
                              {userId && (<div className="flex items-center space-x-3 p-3 bg-white dark:bg-black border-2 border-black dark:border-white rounded-none"><span className="text-black dark:text-white text-sm">Preview:</span><ProfileAvatar userId={userId} size={48} /></div>)}
                              <div>
                                <label className="text-black dark:text-white text-sm font-medium">Visibility</label>
                                <select name="visibility" value={basicProfile?.visibility ?? tempBasicForm.visibility} onChange={e => handleProfileChange('basic', 'visibility', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors">
                                  <option value="public">Public</option>
                                  <option value="friends">Friends Only</option>
                                  <option value="private">Private</option>
                                </select>
                              </div>
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer"><input type="checkbox" checked={basicProfile?.ai_excluded ?? tempBasicForm.ai_excluded} onChange={e => handleProfileChange('basic', 'ai_excluded', e.target.checked)} className="w-4 h-4" /><span className="text-black dark:text-white text-sm font-medium">Exclude from AI</span></label>
                              </div>
                              <button type="submit" className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">{basicProfile ? 'Update' : 'Create'}</button>
                            </form>
                          </div>
                        )}
                        {activeProfileTab === 'love' && (loveProfile || userId) && (
                          <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                            <form onSubmit={(e) => { e.preventDefault(); void handleProfileSave('love'); }} className="flex flex-col gap-4 max-w-md">
                              <div>
                                <label className="block text-sm font-medium mb-2">Name</label>
                                <input type="text" name="display_name" placeholder="Dating profile name" value={loveProfile?.display_name ?? tempLoveForm.display_name} onChange={e => handleProfileChange('love', 'display_name', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Bio</label>
                                <textarea name="bio" placeholder="Dating bio" value={loveProfile?.bio ?? tempLoveForm.bio} onChange={e => handleProfileChange('love', 'bio', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" rows={3} />
                              </div>
                              <ImageUrlInput label="Profile Picture URL" value={loveProfile?.profile_picture_url ?? tempLoveForm.profile_picture_url} onChange={value => handleProfileChange('love', 'profile_picture_url', value)} placeholder="Enter profile picture URL" showPreview={true} validateOnLoad={true} />
                              <div>
                                <label className="text-black dark:text-white text-sm font-medium">Visibility</label>
                                <select name="visibility" value={loveProfile?.visibility ?? tempLoveForm.visibility} onChange={e => handleProfileChange('love', 'visibility', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors">
                                  <option value="public">Public</option>
                                  <option value="friends">Friends Only</option>
                                  <option value="private">Private</option>
                                </select>
                              </div>
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer"><input type="checkbox" checked={loveProfile?.ai_excluded ?? tempLoveForm.ai_excluded} onChange={e => handleProfileChange('love', 'ai_excluded', e.target.checked)} className="w-4 h-4" /><span className="text-black dark:text-white text-sm font-medium">Exclude from AI</span></label>
                              </div>
                              <button type="submit" className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">{loveProfile ? 'Update' : 'Create'}</button>
                            </form>
                          </div>
                        )}
                        {activeProfileTab === 'business' && (businessProfile || userId) && (
                          <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                            <form onSubmit={(e) => { e.preventDefault(); void handleProfileSave('business'); }} className="flex flex-col gap-4 max-w-md">
                              <div>
                                <label className="block text-sm font-medium mb-2">Name</label>
                                <input type="text" name="display_name" placeholder="Professional name" value={businessProfile?.display_name ?? tempBusinessForm.display_name} onChange={e => handleProfileChange('business', 'display_name', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Bio</label>
                                <textarea name="bio" placeholder="Professional bio" value={businessProfile?.bio ?? tempBusinessForm.bio} onChange={e => handleProfileChange('business', 'bio', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" rows={3} />
                              </div>
                              <ImageUrlInput label="Profile Picture URL" value={businessProfile?.profile_picture_url ?? tempBusinessForm.profile_picture_url} onChange={value => handleProfileChange('business', 'profile_picture_url', value)} placeholder="Enter profile picture URL" showPreview={true} validateOnLoad={true} />
                              <div>
                                <label className="text-black dark:text-white text-sm font-medium">Visibility</label>
                                <select name="visibility" value={businessProfile?.visibility ?? tempBusinessForm.visibility} onChange={e => handleProfileChange('business', 'visibility', e.target.value)} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors">
                                  <option value="public">Public</option>
                                  <option value="friends">Friends Only</option>
                                  <option value="private">Private</option>
                                </select>
                              </div>
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer"><input type="checkbox" checked={businessProfile?.ai_excluded ?? tempBusinessForm.ai_excluded} onChange={e => handleProfileChange('business', 'ai_excluded', e.target.checked)} className="w-4 h-4" /><span className="text-black dark:text-white text-sm font-medium">Exclude from AI</span></label>
                              </div>
                              <button type="submit" className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">{businessProfile ? 'Update' : 'Create'}</button>
                            </form>
                          </div>
                        )}
                        {profileMessage && (<div className="text-green-400 text-center mt-4">{profileMessage}</div>)}
                        <MessageExpirySettings className="mt-8" />
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'questionnaires' && (
                  <div>
                    <div className="flex justify-center mb-6 sm:mb-8">
                      <div className="flex flex-col sm:flex-row bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-1">
                        {(['basic', 'business', 'love'] as const).map((type) => (
                          <button key={type} onClick={() => setSelectedProfileType(type)} className={`px-3 sm:px-4 py-2 rounded-none transition-colors text-xs sm:text-sm ${selectedProfileType === type ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-black border-b sm:border-b-0 sm:border-r-2 border-black dark:border-white last:border-none'}`}>
                            {type === 'basic' ? 'General' : type === 'business' ? 'Business' : 'Dating'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {questionnaireLoading ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : questionnaireError ? (
                      <div className="text-center py-8 text-red-400">{questionnaireError}</div>
                    ) : (questionnaireGroups?.length ?? 0) === 0 ? (
                      <div className="text-center py-8 text-gray-400">No questionnaires available</div>
                    ) : (
                      <div className="space-y-6">
                        {(questionnaireGroups ?? []).map((group) => (
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
                                        <button onClick={() => startQuestionnaire(questionnaire.questionnaire_id)} className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-xs sm:text-sm order-1 sm:order-2">Edit</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => startQuestionnaire(questionnaire.questionnaire_id)} className="px-3 sm:px-4 py-1 sm:py-2 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-xs sm:text-sm">Start</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeQuestionnaire && (
                      <div className="mt-6 border-2 border-black dark:border-white rounded-none p-4 bg-white dark:bg-black">
                        <h3 className="text-lg font-bold mb-4">{activeQuestionnaire.title}</h3>
                        <form onSubmit={handleQuestionnaireSubmit} className="space-y-4">
                          {activeQuestionnaire.questions?.map((q) => (
                            <div key={q.question_id} className="border-2 border-black dark:border-white rounded-none p-3">
                              <label className="block text-sm font-medium mb-2">{q.question_text}</label>
                              {q.question_type === 'text' ? (
                                <input value={answers[q.question_id] ?? ''} onChange={(e) => setAnswers(prev => ({ ...prev, [q.question_id]: e.target.value }))} className="w-full p-2 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400" />
                              ) : (
                                <select value={answers[q.question_id] ?? ''} onChange={(e) => setAnswers(prev => ({ ...prev, [q.question_id]: e.target.value }))} className="w-full p-2 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400">
                                  <option value="">Select...</option>
                                  {q.options.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                                </select>
                              )}
                            </div>
                          ))}
                          <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 pt-4 border-t-2 border-black dark:border-white">
                            <button type="button" onClick={() => setActiveQuestionnaire(null)} className="px-4 sm:px-6 py-2 sm:py-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none hover:bg-gray-100 dark:hover:bg-black transition-colors text-xs sm:text-sm">Cancel</button>
                            <button type="submit" disabled={submitting} className="px-4 sm:px-6 py-2 sm:py-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs sm:text-sm">{submitting ? 'Saving...' : 'Save Progress'}</button>
                          </div>
                          {submitMessage && (<div className={`text-center mt-3 ${submitMessage.includes('success') || submitMessage.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>{submitMessage}</div>)}
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'friends' && (<Friends />)}

                {activeTab === 'general' && (
                  <div className="space-y-8">
                    {currentUser?.is_admin && (
                      <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                        <h2 className="text-xl font-bold mb-2">Admin</h2>
                        <p className="text-sm mb-4 text-black dark:text-white">Access the admin dashboard to manage users, groups, and system settings.</p>
                        <button
                          onClick={() => router.push('/admindashboard')}
                          className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-none border-2 border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                        >
                          Open Admin Dashboard
                        </button>
                      </div>
                    )}
                    <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
                      <h2 className="text-xl font-bold mb-4">Change Password</h2>
                      <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 max-w-md">
                        <div>
                          <label className="block text-sm font-medium mb-2">Current Password</label>
                          <input type="password" placeholder="Current password" value={passwordForm.oldPassword} onChange={e => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">New Password</label>
                          <input type="password" placeholder="New password" value={passwordForm.newPassword} onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" required minLength={6} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Confirm Password</label>
                          <input type="password" placeholder="Confirm password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))} className="w-full p-3 bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors" required />
                        </div>
                        <button type="submit" disabled={passwordLoading} className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{passwordLoading ? 'Updating...' : 'Update Password'}</button>
                      </form>
                      {passwordError && (<div className="text-red-400 text-center mt-4">{passwordError}</div>)}
                      {passwordMessage && (<div className="text-green-400 text-center mt-4">{passwordMessage}</div>)}
                    </div>
                    <TwoFactorSettings currentUser={currentUser} />
                    <ThemeToggle />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}