import { useState } from 'react';

export interface ModalStates {
  showCreateGroupModal: boolean;
  showNewDMModal: boolean;
  showMembersModal: boolean;
  showInviteModal: boolean;
  showInvitationsModal: boolean;
  showBannedUsersModal: boolean;
  showCreateChannelModal: boolean;
  showPinnedMessagesModal: boolean;
}

export const useModalStates = () => {
  const [modals, setModals] = useState<ModalStates>({
    showCreateGroupModal: false,
    showNewDMModal: false,
    showMembersModal: false,
    showInviteModal: false,
    showInvitationsModal: false,
    showBannedUsersModal: false,
    showCreateChannelModal: false,
    showPinnedMessagesModal: false
  });

  const openModal = (modalName: keyof ModalStates) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
  };

  const closeModal = (modalName: keyof ModalStates) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
  };

  const closeAllModals = () => {
    setModals({
      showCreateGroupModal: false,
      showNewDMModal: false,
      showMembersModal: false,
      showInviteModal: false,
      showInvitationsModal: false,
      showBannedUsersModal: false,
      showCreateChannelModal: false,
      showPinnedMessagesModal: false
    });
  };

  return {
    modals,
    openModal,
    closeModal,
    closeAllModals
  };
};