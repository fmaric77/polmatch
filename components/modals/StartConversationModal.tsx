import React, { useState } from 'react';
import ProfileSelectionModal from './ProfileSelectionModal';
import NewDMModal from './NewDMModal';

interface Conversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  is_private?: boolean;
  last_message?: string;
  last_activity?: string;
  unread_count?: number;
  members_count?: number;
  user_id?: string;
  creator_id?: string;
  user_role?: string;
}

interface StartConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversation: Conversation) => void;
}

type ProfileType = 'basic' | 'love' | 'business';

const StartConversationModal: React.FC<StartConversationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'profile-selection' | 'user-selection'>('profile-selection');
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>('basic');

  const handleProfileSelected = (profileType: ProfileType): void => {
    setSelectedProfile(profileType);
    setStep('user-selection');
  };

  const handleModalClose = (): void => {
    setStep('profile-selection');
    setSelectedProfile('basic');
    onClose();
  };

  const handleBackToProfileSelection = (): void => {
    setStep('profile-selection');
  };

  const handleConversationSuccess = (conversation: Conversation): void => {
    handleModalClose();
    onSuccess(conversation);
  };

  if (!isOpen) return null;

  return (
    <>
      {step === 'profile-selection' && (
        <ProfileSelectionModal
          isOpen={true}
          onClose={handleModalClose}
          onProfileSelected={(profileType) => handleProfileSelected(profileType)}
        />
      )}
      
      {step === 'user-selection' && (
        <NewDMModal
          onClose={handleBackToProfileSelection}
          onSuccess={handleConversationSuccess}
          senderProfileType={selectedProfile}
          receiverProfileType={selectedProfile}
        />
      )}
    </>
  );
};

export default StartConversationModal;
