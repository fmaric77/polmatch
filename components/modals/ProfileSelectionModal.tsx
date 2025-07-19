import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faHeart, faBriefcase } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../ThemeProvider';

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
  const { theme } = useTheme();
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>('basic');

  const profileOptions = [
    {
      type: 'basic' as ProfileType,
      label: 'General',
      icon: faUser,
      description: 'Standard intelligence operations and networking',
      color: 'text-green-400'
    },
    {
      type: 'love' as ProfileType,
      label: 'Personal',
      icon: faHeart,
      description: 'Confidential personal relationship protocols',
      color: 'text-red-400'
    },
    {
      type: 'business' as ProfileType,
      label: 'Corporate',
      icon: faBriefcase,
      description: 'Classified corporate intelligence operations',
      color: 'text-yellow-400'
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
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none shadow-2xl w-full max-w-2xl`}>
        {/* Header */}
        <div className={`border-b-2 ${theme === 'dark' ? 'border-white bg-white text-black' : 'border-black bg-black text-white'} p-4`}>
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-wider">PROFILE SELECTION</div>
            <button
              onClick={onClose}
              className={`${theme === 'dark' ? 'text-black hover:text-gray-600' : 'text-white hover:text-gray-300'} transition-colors font-mono text-xl`}
            >
              ×
            </button>
          </div>
          <div className="font-mono text-xs mt-1 text-center">SELECT YOUR ACTIVE PROFILE</div>
        </div>

        <div className={`p-6 space-y-6 ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
          <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} text-center mb-6 font-mono text-xs uppercase tracking-wider`}>
            SELECT PROFILE TYPE FOR MESSAGING
          </div>

          {/* Profile Selection */}
          <div>
            <h3 className={`text-lg font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-black'} mb-4 text-center uppercase tracking-wider`}>CHOOSE PROFILE</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profileOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => setSelectedProfile(option.type)}
                  className={`p-6 rounded-none border-2 transition-all font-mono ${
                    selectedProfile === option.type
                      ? theme === 'dark' 
                        ? 'border-white bg-white/10 text-white shadow-2xl'
                        : 'border-black bg-black/10 text-black shadow-2xl'
                      : theme === 'dark'
                        ? 'border-gray-600 hover:border-white text-gray-300 hover:text-white hover:bg-white/5'
                        : 'border-gray-400 hover:border-black text-gray-600 hover:text-black hover:bg-black/5'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <FontAwesomeIcon 
                      icon={option.icon} 
                      className={`text-3xl ${option.color}`}
                    />
                    <span className="font-bold text-lg uppercase tracking-wider">{option.label}</span>
                    <span className="text-xs text-center uppercase tracking-wider">{option.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className={`${theme === 'dark' ? 'bg-gray-900 border-white' : 'bg-gray-100 border-black'} border rounded-none p-4`}>
            <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} text-center font-mono`}>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider mb-2`}>SELECTED PROFILE:</div>
              <span className="font-bold uppercase tracking-wider">{profileOptions.find(p => p.type === selectedProfile)?.label}</span>
              <span className="mx-2">⬌</span>
              <span className="font-bold uppercase tracking-wider">{profileOptions.find(p => p.type === selectedProfile)?.label}</span>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mt-2 uppercase tracking-wider`}>
                ACTIVE PROFILE: {profileOptions.find(p => p.type === selectedProfile)?.label.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className={`flex-1 ${theme === 'dark' ? 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700 hover:border-white' : 'bg-gray-200 text-black border-gray-400 hover:bg-gray-300 hover:border-black'} py-3 px-4 rounded-none border-2 transition-colors font-mono uppercase tracking-wider text-xs`}
            >
              CANCEL
            </button>
            <button
              onClick={handleContinue}
              className={`flex-1 ${theme === 'dark' ? 'bg-white text-black border-white hover:bg-gray-200' : 'bg-black text-white border-black hover:bg-gray-800'} py-3 px-4 rounded-none border-2 transition-colors font-mono uppercase tracking-wider text-xs font-bold`}
            >
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelectionModal;
