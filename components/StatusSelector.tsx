import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import { UserStatus } from './hooks/useUserStatus';
import StatusIndicator from './StatusIndicator';

interface StatusSelectorProps {
  currentStatus: UserStatus;
  customMessage?: string;
  onStatusChange: (status: UserStatus, customMessage?: string) => void;
  loading?: boolean;
  className?: string;
}

const StatusSelector: React.FC<StatusSelectorProps> = ({
  currentStatus,
  customMessage,
  onStatusChange,
  loading = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newCustomMessage, setNewCustomMessage] = useState(customMessage || '');
  const [showCustomMessageInput, setShowCustomMessageInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statusOptions: Array<{ status: UserStatus; label: string; description: string }> = [
    { status: 'online', label: 'Online', description: 'Available to chat' },
    { status: 'away', label: 'Away', description: 'Stepped away from keyboard' },
    { status: 'dnd', label: 'Do Not Disturb', description: 'Please do not disturb' },
    { status: 'offline', label: 'Offline', description: 'Appear offline to others' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomMessageInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSelect = (status: UserStatus) => {
    if (status === currentStatus && !showCustomMessageInput) {
      setShowCustomMessageInput(true);
      return;
    }

    onStatusChange(status, newCustomMessage || undefined);
    setIsOpen(false);
    setShowCustomMessageInput(false);
  };

  const handleCustomMessageSubmit = () => {
    onStatusChange(currentStatus, newCustomMessage || undefined);
    setShowCustomMessageInput(false);
    setIsOpen(false);
  };

  const currentStatusConfig = statusOptions.find(opt => opt.status === currentStatus);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Status Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-black/60 border border-white/30 rounded hover:bg-black/80 transition-colors disabled:opacity-50 w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <StatusIndicator status={currentStatus} size="small" inline />
          <div className="flex flex-col items-start">
            <span className="text-sm font-mono uppercase tracking-wider text-white">
              {currentStatusConfig?.label || 'Unknown'}
            </span>
            {customMessage && (
              <span className="text-xs text-gray-400 italic">
                {customMessage}
              </span>
            )}
          </div>
        </div>
        <FontAwesomeIcon 
          icon={faChevronDown} 
          className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-white/30 rounded shadow-lg z-50">
          {/* Status Options */}
          <div className="py-1">
            {statusOptions.map((option) => (
              <button
                key={option.status}
                onClick={() => handleStatusSelect(option.status)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
              >
                <StatusIndicator status={option.status} size="small" inline />
                <div className="flex-1">
                  <div className="text-sm font-mono uppercase tracking-wider text-white">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-400">
                    {option.description}
                  </div>
                </div>
                {option.status === currentStatus && (
                  <FontAwesomeIcon icon={faCheck} className="text-green-400 text-xs" />
                )}
              </button>
            ))}
          </div>

          {/* Custom Message Input */}
          {showCustomMessageInput && (
            <div className="border-t border-white/30 p-3">
              <div className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
                Custom Status Message
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCustomMessage}
                  onChange={(e) => setNewCustomMessage(e.target.value)}
                  placeholder="What's your status?"
                  className="flex-1 px-2 py-1 bg-black border border-white/30 rounded text-white text-sm"
                  maxLength={100}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomMessageSubmit();
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCustomMessageSubmit}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          )}

          {/* Clear Custom Message */}
          {customMessage && !showCustomMessageInput && (
            <div className="border-t border-white/30">
              <button
                onClick={() => onStatusChange(currentStatus, undefined)}
                className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-left"
              >
                Clear custom message
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusSelector; 