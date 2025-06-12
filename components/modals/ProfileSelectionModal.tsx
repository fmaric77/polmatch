import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUser, faHeart, faBriefcase } from '@fortawesome/free-solid-svg-icons';

interface ProfileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSelected: (profileType: 'basic' | 'love' | 'business') => void;
}

type ProfileType = 'basic' | 'love' | 'business';

const ProfileSelectionModal: React.FC<ProfileSelectionModalProps> = ({
  isOpen,
  onClose,
  onProfileSelected
}) => {
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>('basic');

  const profileOptions = [
    {
      type: 'basic' as ProfileType,
      label: 'Basic',
      icon: faUser,
      description: 'General conversations and networking',
      color: 'text-blue-400'
    },
    {
      type: 'love' as ProfileType,
      label: 'Love',
      icon: faHeart,
      description: 'Dating and romantic connections',
      color: 'text-pink-400'
    },
    {
      type: 'business' as ProfileType,
      label: 'Business',
      icon: faBriefcase,
      description: 'Professional networking and career',
      color: 'text-green-400'
    }
  ];

  const handleContinue = (): void => {
    onProfileSelected(selectedProfile);
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Choose Conversation Profiles</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="text-gray-300 text-center mb-6">
            Select which profile type you want to use for this conversation. You can only connect with users who have the same profile type.
          </div>

          {/* Profile Selection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Choose Your Profile Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profileOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => setSelectedProfile(option.type)}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    selectedProfile === option.type
                      ? 'border-white bg-white/10 text-white'
                      : 'border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <FontAwesomeIcon 
                      icon={option.icon} 
                      className={`text-3xl ${option.color}`}
                    />
                    <span className="font-medium text-lg">{option.label}</span>
                    <span className="text-sm text-center">{option.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-white text-center">
              <span className="font-medium">You will connect: </span>
              <span className={profileOptions.find(p => p.type === selectedProfile)?.color}>
                {profileOptions.find(p => p.type === selectedProfile)?.label}
              </span>
              <span className="mx-2">↔</span>
              <span className={profileOptions.find(p => p.type === selectedProfile)?.color}>
                {profileOptions.find(p => p.type === selectedProfile)?.label}
              </span>
              <div className="text-sm text-gray-300 mt-2">
                Only users with {profileOptions.find(p => p.type === selectedProfile)?.label.toLowerCase()} profiles will be shown
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white py-3 px-4 rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 bg-white text-black py-3 px-4 rounded hover:bg-gray-200 transition-colors font-medium"
            >
              Continue to User Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelectionModal;
