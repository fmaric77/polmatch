import React from 'react';
import { TypingData } from './hooks/useTypingIndicator';

interface TypingIndicatorProps {
  typingUsers: TypingData[];
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers, className = '' }) => {
  if (typingUsers.length === 0) {
    return null;
  }

  const renderTypingText = (): string => {
    const usernames = typingUsers.map(user => user.username);
    
    if (usernames.length === 1) {
      return `${usernames[0]} is typing...`;
    } else if (usernames.length === 2) {
      return `${usernames[0]} and ${usernames[1]} are typing...`;
    } else if (usernames.length === 3) {
      return `${usernames[0]}, ${usernames[1]}, and ${usernames[2]} are typing...`;
    } else {
      return `${usernames[0]}, ${usernames[1]}, and ${usernames.length - 2} others are typing...`;
    }
  };

  return (
    <div className={`flex items-center space-x-2 text-gray-400 text-sm animate-pulse ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span>{renderTypingText()}</span>
    </div>
  );
};

export default TypingIndicator;
