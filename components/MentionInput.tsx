import React, { useState, useRef, useEffect } from 'react';
import ProfileAvatar from './ProfileAvatar';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  users?: User[];
  theme?: 'dark' | 'light';
}

/**
 * Reusable input component with Discord-style @mention functionality
 * Can be used in any form or chat interface
 */
const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type your message...",
  className = "",
  users = [],
  theme = 'dark'
}) => {
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to detect and show mention suggestions
  const handleMention = (text: string, cursorPos: number) => {
    const uptoCursor = text.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    
    if (atIndex >= 0) {
      const query = uptoCursor.slice(atIndex + 1);
      // Allow letters, numbers, and underscores for usernames
      if (/^\w*$/.test(query)) {
        setMentionQuery(query);
        // Show all users when just '@', otherwise filter by query
        const matches = query === ''
          ? users
          : users.filter(u =>
              u.username.toLowerCase().startsWith(query.toLowerCase()) ||
              (u.display_name && u.display_name.toLowerCase().startsWith(query.toLowerCase()))
            );
        setMentionSuggestions(matches);
        setShowMentionSuggestions(matches.length > 0);
        setSelectedMentionIndex(0); // Reset selection to first item
        return;
      }
    }
    setShowMentionSuggestions(false);
  };

  // Function to insert mention into input
  const insertMention = (user: User) => {
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const text = value;
    const uptoCursor = text.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    
    if (atIndex >= 0) {
      const before = text.slice(0, atIndex);
      const after = text.slice(cursorPos);
      const mention = `@${user.username} `;
      const newText = before + mention + after;
      
      onChange(newText);
      setShowMentionSuggestions(false);
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = atIndex + mention.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.focus();
      }, 0);
    }
  };

  // Function to handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentionSuggestions) {
      onKeyDown?.(e);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (mentionSuggestions[selectedMentionIndex]) {
          insertMention(mentionSuggestions[selectedMentionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowMentionSuggestions(false);
        break;
      default:
        onKeyDown?.(e);
        break;
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val);
          handleMention(val, e.target.selectionStart || val.length);
        }}
        onKeyDown={handleMentionKeyDown}
        placeholder={placeholder}
        className={`${className} ${
          theme === 'dark' 
            ? 'bg-black text-white border-white focus:border-blue-400' 
            : 'bg-white text-black border-black focus:border-blue-600'
        }`}
      />
      
      {/* Mention suggestions dropdown */}
      {showMentionSuggestions && (
        <div className={`absolute bottom-full left-0 mb-2 w-full max-h-40 overflow-auto ${
          theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'
        } border-2 rounded-none shadow-lg z-50 font-mono`}>
          {mentionSuggestions.map((user, index) => (
            <div
              key={user.user_id}
              className={`px-3 py-2 cursor-pointer transition-colors border-b border-gray-600 last:border-b-0 ${
                index === selectedMentionIndex
                  ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-black')
                  : (theme === 'dark' ? 'hover:bg-white/20 text-white' : 'hover:bg-black/20 text-black')
              }`}
              onMouseEnter={() => setSelectedMentionIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                insertMention(user);
              }}
            >
              <div className="flex items-center space-x-2">
                <ProfileAvatar userId={user.user_id} size={20} />
                <span className="font-bold">@{user.username}</span>
                {user.display_name && (
                  <span className={`text-sm ${
                    index === selectedMentionIndex
                      ? (theme === 'dark' ? 'text-gray-200' : 'text-gray-800')
                      : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                  }`}>
                    ({user.display_name})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
