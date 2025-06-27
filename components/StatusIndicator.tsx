import React from 'react';
import { UserStatus } from './hooks/useUserStatus';

interface StatusIndicatorProps {
  status: UserStatus;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  customMessage?: string;
  className?: string;
  inline?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'medium',
  showLabel = false,
  customMessage,
  className = '',
  inline = false
}) => {
  const getStatusConfig = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return {
          color: '#22c55e',
          bgColor: 'bg-green-500',
          label: 'Online',
          icon: '●'
        };
      case 'away':
        return {
          color: '#fbbf24',
          bgColor: 'bg-yellow-500',
          label: 'Away',
          icon: '●'
        };
      case 'dnd':
        return {
          color: '#ef4444',
          bgColor: 'bg-red-500',
          label: 'Do Not Disturb',
          icon: '●'
        };
      case 'offline':
      default:
        return {
          color: '#6b7280',
          bgColor: 'bg-gray-500',
          label: 'Offline',
          icon: '●'
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'small':
        return {
          dot: 'w-2 h-2',
          text: 'text-xs',
          gap: 'gap-1'
        };
      case 'large':
        return {
          dot: 'w-4 h-4',
          text: 'text-base',
          gap: 'gap-3'
        };
      case 'medium':
      default:
        return {
          dot: 'w-3 h-3',
          text: 'text-sm',
          gap: 'gap-2'
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);

  if (inline) {
    // Inline version - just the colored dot
    return (
      <span
        className={`inline-block ${sizeClasses.dot} ${config.bgColor} rounded-full border border-black/20 ${className}`}
        title={`${config.label}${customMessage ? ` - ${customMessage}` : ''}`}
        style={{ backgroundColor: config.color }}
      />
    );
  }

  return (
    <div className={`flex items-center ${sizeClasses.gap} ${className}`}>
      <span
        className={`${sizeClasses.dot} ${config.bgColor} rounded-full border border-black/20 flex-shrink-0`}
        style={{ backgroundColor: config.color }}
      />
      {showLabel && (
        <div className="flex flex-col">
          <span className={`${sizeClasses.text} font-mono uppercase tracking-wider text-white`}>
            {config.label}
          </span>
          {customMessage && (
            <span className="text-xs text-gray-400 italic">
              {customMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusIndicator; 