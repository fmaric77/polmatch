import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrash,
  faUserMinus,
  faCopy
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface ContextMenuItem {
  id: string;
  label: string;
  icon: IconDefinition;
  color?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    type: 'conversation' | 'message' | 'member' | 'channel';
    id: string;
    extra?: {
      user_id?: string;
      members?: Array<{
        user_id: string;
        role: string;
      }>;
      [key: string]: unknown;
    };
  };
  setContextMenu: React.Dispatch<React.SetStateAction<{
    x: number;
    y: number;
    type: 'conversation' | 'message' | 'member' | 'channel';
    id: string;
    extra?: unknown;
  } | null>>;
  conversations: {
    conversations: Array<{
      id: string;
      name: string;
      type: 'direct' | 'group';
      is_private?: boolean;
      last_message?: string;
      last_activity?: string;
      unread_count?: number;
      members_count?: number;
      user_id?: string;
    }>;
    fetchConversations: () => void;
    archiveConversation: (id: string) => Promise<boolean>;
    leaveGroup: (id: string) => Promise<boolean>;
  };
  groupManagement: {
    removeGroupMember: (groupId: string, userId: string) => Promise<boolean>;
    deleteChannel: (groupId: string, channelId: string) => Promise<boolean>;
  };
  messages: {
    deleteMessage: (messageId: string) => Promise<boolean>;
  };
  currentUser: {
    user_id: string;
    username: string;
    is_admin?: boolean;
  } | null;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  setContextMenu,
  conversations,
  groupManagement,
  messages,
  currentUser
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, setContextMenu]);

  useEffect(() => {
    if (contextMenu && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust position if menu would go off-screen
      let adjustedX = contextMenu.x;
      let adjustedY = contextMenu.y;

      if (contextMenu.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (contextMenu.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      menu.style.left = `${Math.max(10, adjustedX)}px`;
      menu.style.top = `${Math.max(10, adjustedY)}px`;
    }
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const handleItemClick = (item: ContextMenuItem): void => {
    if (!item.disabled) {
      item.onClick();
      setContextMenu(null);
    }
  };

  // Get the appropriate items based on context menu type
  const getMenuItems = (): ContextMenuItem[] => {
    switch (contextMenu.type) {
      case 'message': {
        const message = contextMenu.extra as { content?: string; sender_id?: string; [key: string]: unknown };
        const isOwnMessage = currentUser?.user_id === message?.sender_id;
        
        const messageItems: ContextMenuItem[] = [
          {
            id: 'copy',
            label: 'Copy Text',
            icon: faCopy,
            onClick: () => {
              if (message.content) {
                navigator.clipboard.writeText(message.content);
              }
            }
          },
          {
            id: 'delete',
            label: 'Delete Message',
            icon: faTrash,
            color: 'text-red-500',
            disabled: !isOwnMessage,
            onClick: () => {
              // Use contextMenu.id instead of message.id - this is the fix!
              messages.deleteMessage(contextMenu.id);
            }
          }
        ];

        return messageItems;
      }
      case 'member': {
        const member = contextMenu.extra as { user_id: string; role: string };
        const isAdmin = currentUser?.is_admin;

        const memberItems: ContextMenuItem[] = [
          {
            id: 'remove',
            label: 'Remove from Group',
            icon: faUserMinus,
            color: 'text-red-500',
            disabled: !isAdmin,
            onClick: () => {
              groupManagement.removeGroupMember(contextMenu.id, member.user_id);
            }
          }
        ];

        return memberItems;
      }
      case 'channel': {
        const isAdmin = currentUser?.is_admin;

        const channelItems: ContextMenuItem[] = [
          {
            id: 'delete-channel',
            label: 'Delete Channel',
            icon: faTrash,
            color: 'text-red-500',
            disabled: !isAdmin,
            onClick: () => {
              groupManagement.deleteChannel(conversations.conversations.find(conv => conv.id === contextMenu.id)?.id || '', contextMenu.id);
            }
          }
        ];

        return channelItems;
      }
      default:
        return [];
    }
  };

  const items = getMenuItems();

  return (
    <div 
      ref={menuRef} 
      className="fixed z-50 bg-gray-700 rounded-lg shadow-lg overflow-hidden"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {items.map((item) => (
          <React.Fragment key={item.id}>
            {item.separator && (
              <div className="border-t border-gray-600 my-1" />
            )}
            <button
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={`
                w-full px-3 py-2 text-left flex items-center space-x-3 transition-colors
                ${item.disabled 
                  ? 'text-gray-500 cursor-not-allowed' 
                  : `text-white hover:bg-gray-800 ${item.color || ''}`
                }
              `}
            >
              <FontAwesomeIcon 
                icon={item.icon} 
                className={`w-4 h-4 ${item.color || 'text-gray-400'}`} 
              />
              <span className="text-sm">{item.label}</span>
            </button>
          </React.Fragment>
        ))}
    </div>
  );
};

export default ContextMenu;