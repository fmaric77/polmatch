import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';

interface CallNotificationProps {
  caller: {
    user_id: string;
    username: string;
    display_name?: string;
  };
  onAccept: () => void;
  onDecline: () => void;
  isVisible: boolean;
}
//daw
const CallNotification: React.FC<CallNotificationProps> = ({
  caller,
  onAccept,
  onDecline,
  isVisible
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 bg-black border-2 border-green-400 rounded-none shadow-2xl z-50 p-4 max-w-sm">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-green-400 rounded-none flex items-center justify-center">
          <FontAwesomeIcon icon={faPhone} className="text-black animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-white text-sm uppercase tracking-wider">
            INCOMING CALL
          </p>
          <p className="font-mono text-green-400 text-xs">
            {caller.display_name || caller.username}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onAccept}
            className="p-2 bg-green-600 hover:bg-green-700 border border-green-400 rounded-none transition-colors"
            title="Accept Call"
          >
            <FontAwesomeIcon icon={faPhone} className="text-white text-sm" />
          </button>
          <button
            onClick={onDecline}
            className="p-2 bg-red-600 hover:bg-red-700 border border-red-400 rounded-none transition-colors"
            title="Decline Call"
          >
            <FontAwesomeIcon icon={faPhoneSlash} className="text-white text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallNotification;
