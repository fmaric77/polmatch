import React, { useState, useEffect, useCallback } from 'react';
import ProfileAvatar from './ProfileAvatar';

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

const ProfileModal: React.FC<ProfileModalProps> = ({ userId, username, isOpen, onClose, defaultActiveTab, restrictToProfileType = false }) => {
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'basic' | 'love' | 'business'>('basic');

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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-black border border-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white">
          <div className="flex items-center space-x-3">
            <ProfileAvatar userId={userId} size={48} />
            <div>
              <h2 className="text-xl font-bold text-white">{username}&apos;s Profile</h2>
              {profileData?.is_friends && (
                <span className="text-sm text-green-400">✓ Friends</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="text-white">Loading profile...</div>
            </div>
          )}

          {error && (
            <div className="p-6 text-center text-red-400">
              {error}
            </div>
          )}

          {profileData && !loading && (
            <>
              {/* Profile Tabs */}
              <div className="flex border-b border-white">
                {(restrictToProfileType && defaultActiveTab ? [defaultActiveTab] : ['basic', 'love', 'business']).map((tab) => {
                  const tabKey = tab as 'basic' | 'love' | 'business';
                  const hasProfile = profileData.profiles[tabKey];
                  
                  if (!hasProfile) return null;
                  
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tabKey)}
                      className={`px-6 py-3 font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'text-black bg-white border-b-2 border-white'
                          : 'text-gray-300 hover:text-white hover:bg-black/50'
                      }`}
                    >
                      {tab} Profile
                    </button>
                  );
                })}
              </div>

              {/* Profile Content */}
              <div className="p-6">
                {profileData.profiles[activeTab] ? (
                  <div className="space-y-6">
                    {/* Profile Info */}
                    <div className="bg-black border border-white rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3">Profile Information</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-400">Display Name: </span>
                          <span className="text-white">
                            {profileData.profiles[activeTab]?.display_name || 'Not set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Bio: </span>
                          <span className="text-white">
                            {profileData.profiles[activeTab]?.bio || 'No bio available'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Visibility: </span>
                          <span className={`capitalize font-medium ${
                            profileData.profiles[activeTab]?.visibility === 'public' ? 'text-green-400' :
                            profileData.profiles[activeTab]?.visibility === 'friends' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {profileData.profiles[activeTab]?.visibility === 'friends' ? 'Friends Only' : 
                             profileData.profiles[activeTab]?.visibility || 'Public'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Questionnaire Answers */}
                    {profileData.questionnaire_answers[activeTab] && 
                     profileData.questionnaire_answers[activeTab].length > 0 && (
                      <div className="bg-black border border-white rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Questionnaire Answers</h3>
                        <div className="space-y-4">
                          {profileData.questionnaire_answers[activeTab].map((questionnaire) => (
                            <div key={questionnaire._id} className="border border-white rounded-lg p-4">
                              <h4 className="font-medium text-white mb-2">
                                {questionnaire.questionnaire_title}
                              </h4>
                              {questionnaire.questionnaire_description && (
                                <p className="text-gray-400 text-sm mb-3">
                                  {questionnaire.questionnaire_description}
                                </p>
                              )}
                              <div className="space-y-2">
                                {questionnaire.answers.map((answer) => (
                                  <div key={answer.question_id} className="border-l-2 border-white pl-3">
                                    <p className="text-gray-300 text-sm font-medium">
                                      {answer.question_text}
                                    </p>
                                    <p className="text-white">
                                      {answer.answer}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No questionnaires message */}
                    {(!profileData.questionnaire_answers[activeTab] || 
                      profileData.questionnaire_answers[activeTab].length === 0) && (
                      <div className="bg-black border border-white rounded-lg p-4 text-center">
                        <p className="text-gray-400">No questionnaire answers available for this profile.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">
                      This profile is not available or visible to you.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
