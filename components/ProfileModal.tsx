import React, { useState, useEffect, useCallback } from 'react';
import ProfileAvatar from './ProfileAvatar';
import { getAnonymousDisplayName } from '../lib/anonymization';
import { useTheme } from './ThemeProvider';

interface Profile {
  profile_id: string;
  user_id: string;
  display_name: string;
  bio: string;
  profile_picture_url: string;
  visibility: string;
  last_updated: string;
}

interface QuestionnaireAnswer {
  question_id: string;
  question_text: string;
  answer: string;
  completion_date: string;
  profile_display_text?: string;
}

interface QuestionnaireGroup {
  _id: string;
  questionnaire_title: string;
  questionnaire_description: string;
  group_title: string;
  answers: QuestionnaireAnswer[];
}

interface UserProfileData {
  user: {
    user_id: string;
    username: string;
  };
  profiles: {
    basic: Profile | null;
    love: Profile | null;
    business: Profile | null;
  };
  questionnaire_answers: {
    basic: QuestionnaireGroup[];
    love: QuestionnaireGroup[];
    business: QuestionnaireGroup[];
  };
  is_friends: boolean;
}

interface ProfileModalProps {
  userId: string;
  username: string;
  isOpen: boolean;
  onClose: () => void;
  defaultActiveTab?: 'basic' | 'love' | 'business';
  restrictToProfileType?: boolean; // New prop to restrict modal to only show one profile type
}

const ProfileModal: React.FC<ProfileModalProps> = ({ userId, isOpen, onClose, defaultActiveTab, restrictToProfileType = false }) => {
  const { theme } = useTheme();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'basic' | 'love' | 'business'>('basic');
  const [expandedQuestionnaires, setExpandedQuestionnaires] = useState<Set<string>>(new Set());

  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/profile?user_id=${userId}`);
      const data = await res.json();
      
      if (data.success) {
        setProfileData(data);
        // Set active tab based on defaultActiveTab prop or first available profile
        if (defaultActiveTab && data.profiles[defaultActiveTab]) {
          setActiveTab(defaultActiveTab);
        } else if (data.profiles.basic) {
          setActiveTab('basic');
        } else if (data.profiles.love) {
          setActiveTab('love');
        } else if (data.profiles.business) {
          setActiveTab('business');
        }
      } else {
        setError(data.message || 'Failed to load profile');
      }
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId, defaultActiveTab]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfileData();
    }
  }, [isOpen, userId, fetchProfileData]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const toggleQuestionnaire = (questionnaireId: string) => {
    const newExpanded = new Set(expandedQuestionnaires);
    if (newExpanded.has(questionnaireId)) {
      newExpanded.delete(questionnaireId);
    } else {
      newExpanded.add(questionnaireId);
    }
    setExpandedQuestionnaires(newExpanded);
  };

  // Category labels matching catalogue style
  const categoryLabels = {
    basic: 'GENERAL',
    love: 'PERSONAL', 
    business: 'CORPORATE'
  };

  const categoryColors = {
    basic: theme === 'dark' 
      ? 'bg-gray-900 hover:bg-gray-800 border-gray-700'
      : 'bg-gray-200 hover:bg-gray-300 border-gray-400 text-black',
    love: theme === 'dark'
      ? 'bg-red-900 hover:bg-red-800 border-red-700'
      : 'bg-red-200 hover:bg-red-300 border-red-400 text-black',
    business: theme === 'dark'
      ? 'bg-green-900 hover:bg-green-800 border-green-700'
      : 'bg-green-200 hover:bg-green-300 border-green-400 text-black'
  };

  return (
    <div 
      className={`fixed inset-0 ${theme === 'dark' ? 'bg-black' : 'bg-white'} bg-opacity-50 flex items-center justify-center z-50 p-4`}
      onClick={handleOverlayClick}
    >
      <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden`}>
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="text-center py-12">
              <div className={`font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>ACCESSING CLASSIFIED PROFILE...</div>
              <div className="text-red-400 animate-pulse">● ● ●</div>
            </div>
          )}

          {error && (
            <div className="p-6 text-center">
              <div className={`font-mono text-red-400 border border-red-400 ${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-100'} p-4`}>
                ⚠ ACCESS DENIED: {error.toUpperCase()}
              </div>
            </div>
          )}

          {profileData && !loading && (
            <>
              {/* Profile Type Selection */}
              <div className={`p-6 border-b-2 ${theme === 'dark' ? 'border-white' : 'border-black'}`}>
                <div className="flex justify-center gap-2">
                  <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mr-4 self-center`}>PROFILE TYPE:</div>
                  {(restrictToProfileType && defaultActiveTab ? [defaultActiveTab] : ['basic', 'love', 'business']).map((tab) => {
                    const tabKey = tab as 'basic' | 'love' | 'business';
                    const hasProfile = profileData.profiles[tabKey];
                    
                    if (!hasProfile) return null;
                    
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tabKey)}
                        className={`px-4 py-2 border-2 font-mono text-sm tracking-wider transition-all ${
                          activeTab === tab
                            ? `${categoryColors[tabKey]} ${theme === 'dark' ? 'text-white' : 'text-black'}`
                            : `${theme === 'dark' ? 'border-gray-600 bg-black text-gray-400 hover:border-gray-400 hover:text-white' : 'border-gray-400 bg-white text-gray-600 hover:border-gray-600 hover:text-black'}`
                        }`}
                      >
                        {categoryLabels[tabKey]}
                      </button>
                    );
                  })}
                </div>
                {profileData?.is_friends && (
                  <div className="text-center mt-3">
                    <span className={`text-xs font-mono text-green-400 border border-green-400 ${theme === 'dark' ? 'bg-green-900/20' : 'bg-green-100'} px-2 py-1`}>
                      ✓ ALLIED STATUS CONFIRMED
                    </span>
                  </div>
                )}
              </div>

              {/* Profile Content */}
              <div className="p-6">
                {profileData.profiles[activeTab] ? (
                  <div className="space-y-6">
                    {/* Subject File Card */}
                    <div className={`border ${theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-400 bg-gray-100/50'}`}>
                      {/* File Header */}
                      <div className={`${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'} p-2 font-mono text-xs flex justify-between`}>
                        <div>
                          <span className="font-bold">SUBJECT DOSSIER - {categoryLabels[activeTab]}</span>
                        </div>
                        <div>
                          LAST UPDATED: {new Date(profileData.profiles[activeTab]?.last_updated || '').toLocaleDateString('en-US').replace(/\//g, '.')}
                        </div>
                      </div>
                      
                      {/* File Content */}
                      <div className="p-4">
                        <div className="flex items-start space-x-4">
                          {/* Photo Section */}
                          <div className={`border-2 ${theme === 'dark' ? 'border-white bg-gray-800' : 'border-black bg-gray-200'} p-2`}>
                            <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1 text-center`}>PHOTO</div>
                            <ProfileAvatar userId={userId} size={64} className={`border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-400'}`} />
                            <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mt-1 text-center`}>ID: {userId.substring(0, 8).toUpperCase()}</div>
                          </div>
                          
                          {/* Subject Details */}
                          <div className="flex-1 font-mono">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                              <div>
                                <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>SUBJECT NAME:</span>
                                <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-bold tracking-wider`}>
                                  {getAnonymousDisplayName(profileData.profiles[activeTab]?.display_name, null, userId)}
                                </div>
                              </div>
                              <div>
                                <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>VISIBILITY STATUS:</span>
                                <div className={`font-bold ${
                                  profileData.profiles[activeTab]?.visibility === 'public' ? 'text-green-400' :
                                  profileData.profiles[activeTab]?.visibility === 'friends' ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {profileData.profiles[activeTab]?.visibility === 'friends' ? 'RESTRICTED' : 
                                   profileData.profiles[activeTab]?.visibility === 'private' ? 'CLASSIFIED' : 'PUBLIC'}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>BIOGRAPHICAL DATA:</span>
                                <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mt-1`}>
                                  {profileData.profiles[activeTab]?.bio || 'NO DATA AVAILABLE'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Questionnaire Files */}
                    {profileData.questionnaire_answers[activeTab] && 
                     profileData.questionnaire_answers[activeTab].length > 0 && (
                      <div className={`border ${theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-400 bg-gray-100/50'}`}>
                        {/* Section Header */}
                        <div className={`${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'} p-2 font-mono text-xs`}>
                          <span className="font-bold">QUESTIONNAIRE REPORTS - {categoryLabels[activeTab]}</span>
                          <span className="ml-4">TOTAL FILES: {profileData.questionnaire_answers[activeTab].length.toString().padStart(2, '0')}</span>
                        </div>
                        
                        <div className="p-4 space-y-3">
                          {profileData.questionnaire_answers[activeTab].map((questionnaire) => {
                            const isExpanded = expandedQuestionnaires.has(questionnaire._id);
                            return (
                              <div key={questionnaire._id} className={`border ${theme === 'dark' ? 'border-gray-500 bg-black' : 'border-gray-400 bg-white'}`}>
                                {/* Questionnaire Header - Clickable */}
                                <button
                                  onClick={() => toggleQuestionnaire(questionnaire._id)}
                                  className={`w-full ${theme === 'dark' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-200 text-black hover:bg-gray-300'} p-3 font-mono text-xs flex justify-between items-center transition-colors`}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold">FILE:</span>
                                    <span>{questionnaire.questionnaire_title.toUpperCase()}</span>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>ITEMS: {questionnaire.answers.length.toString().padStart(2, '0')}</span>
                                    <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                      ▶
                                    </span>
                                  </div>
                                </button>
                                
                                {/* Questionnaire Content - Collapsible */}
                                {isExpanded && (
                                  <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-500' : 'border-gray-400'}`}>
                                    {questionnaire.questionnaire_description && (
                                      <div className={`mb-4 p-2 ${theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-100 border-gray-400'} border`}>
                                        <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>DESCRIPTION:</div>
                                        <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{questionnaire.questionnaire_description}</div>
                                      </div>
                                    )}
                                    <div className="space-y-3">
                                      {questionnaire.answers.map((answer, index) => {
                                        // Use profile_display_text if available, otherwise use question_text
                                        let displayText = answer.question_text;
                                        let hasAnswerPlaceholder = false;
                                        
                                        if (answer.profile_display_text && answer.profile_display_text.trim()) {
                                          // Check if the profile display text contains the {answer} placeholder
                                          hasAnswerPlaceholder = answer.profile_display_text.includes('{answer}');
                                          // Replace placeholder with user's answer in profile_display_text
                                          displayText = answer.profile_display_text.replace(/\{answer\}/g, answer.answer);
                                        }
                                        
                                        return (
                                          <div key={answer.question_id} className={`border-l-4 ${theme === 'dark' ? 'border-white' : 'border-black'} pl-4 py-2`}>
                                            <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                                              Q{(index + 1).toString().padStart(2, '0')}:
                                            </div>
                                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} font-medium mb-2`}>
                                              {displayText}
                                            </div>
                                            {/* Show raw answer if: 1) no profile_display_text OR 2) profile_display_text doesn't contain {answer} placeholder */}
                                            {(!answer.profile_display_text || !answer.profile_display_text.trim() || !hasAnswerPlaceholder) && (
                                              <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-mono`}>
                                                {answer.answer}
                                              </div>
                                            )}
                                            {answer.completion_date && (
                                              <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} mt-1`}>
                                                RECORDED: {new Date(answer.completion_date).toLocaleDateString('en-US').replace(/\//g, '.')}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* No security footer needed */}
                      </div>
                    )}

                    {/* No questionnaires message */}
                    {(!profileData.questionnaire_answers[activeTab] || 
                      profileData.questionnaire_answers[activeTab].length === 0) && (
                      <div className={`border ${theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-400 bg-gray-100/50'} text-center py-8`}>
                        <div className={`font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                          NO QUESTIONNAIRE FILES ON RECORD
                        </div>
                        <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                          SUBJECT HAS NOT COMPLETED ANY QUESTIONNAIRES FOR {categoryLabels[activeTab]} PROFILE
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`text-center py-8 border ${theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-400 bg-gray-100/50'}`}>
                    <div className={`font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                      PROFILE ACCESS DENIED
                    </div>
                    <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                      {categoryLabels[activeTab]} PROFILE NOT AVAILABLE OR RESTRICTED
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Close Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={onClose}
            className={`${theme === 'dark' ? 'bg-red-900 text-white border-red-700 hover:bg-red-800' : 'bg-red-200 text-black border-red-400 hover:bg-red-300'} p-2 font-mono text-xs border transition-colors tracking-wider`}
          >
            ✕ CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
