import React, { useState } from 'react';
import { useMessageExpiry } from './hooks/useMessageExpiry';
//da
type ProfileType = 'basic' | 'love' | 'business';

interface MessageExpirySettingsProps {
  className?: string;
}

const MessageExpirySettings: React.FC<MessageExpirySettingsProps> = ({ className = '' }) => {
  const { settings, loading, error, updateSetting } = useMessageExpiry();
  const [saving, setSaving] = useState<ProfileType | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleToggleExpiry = async (profileType: ProfileType, enabled: boolean) => {
    setSaving(profileType);
    setSuccessMessage('');
    
    const currentDays = settings[profileType]?.expiry_days || 30;
    const success = await updateSetting(profileType, enabled, currentDays);
    
    if (success) {
      setSuccessMessage('Updated');
      setTimeout(() => setSuccessMessage(''), 2000);
    }
    
    setSaving(null);
  };

  const handleUpdateDays = async (profileType: ProfileType, days: number) => {
    if (days < 1 || days > 365) return;
    
    setSaving(profileType);
    setSuccessMessage('');
    
    const currentEnabled = settings[profileType]?.expiry_enabled || false;
    const success = await updateSetting(profileType, currentEnabled, days);
    
    if (success) {
      setSuccessMessage('Updated');
      setTimeout(() => setSuccessMessage(''), 2000);
    }
    
    setSaving(null);
  };

  const getProfileDisplayName = (profileType: ProfileType): string => {
    switch (profileType) {
      case 'basic': return 'General';
      case 'love': return 'Dating';
      case 'business': return 'Business';
      default: return profileType;
    }
  };

  if (loading) {
    return (
      <div className={`bg-black/40 border border-white/30 rounded-lg p-4 ${className}`}>
        <div className="text-center py-4 font-mono uppercase tracking-wider text-white/60 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/40 border border-white/30 rounded-lg ${className}`}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <h2 className="text-lg font-mono font-bold uppercase tracking-wider text-white flex items-center">
          ⏱️ Auto-Delete Messages
        </h2>
        <span className={`text-white transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
          ▼
        </span>
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-4 pt-0 border-t border-white/20">
          {error && (
            <div className="mb-3 p-2 bg-red-600/20 border border-red-500/50 rounded text-red-400 font-mono text-xs">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-3 p-2 bg-green-600/20 border border-green-500/50 rounded text-green-400 font-mono text-xs">
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            {Object.entries(settings).map(([profileType, setting]) => {
              const typedProfileType = profileType as ProfileType;
              const isSaving = saving === typedProfileType;
              
              return (
                <div 
                  key={profileType} 
                  className="bg-black/60 border border-white/20 rounded p-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-mono font-semibold text-white uppercase tracking-wider">
                      {getProfileDisplayName(typedProfileType)}
                    </h3>
                    
                    <div className="flex items-center space-x-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={setting?.expiry_enabled || false}
                          onChange={(e) => handleToggleExpiry(typedProfileType, e.target.checked)}
                          disabled={isSaving}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white peer-disabled:opacity-50"></div>
                      </label>
                      
                      {isSaving && (
                        <div className="text-white/60 font-mono text-xs">...</div>
                      )}
                    </div>
                  </div>
                  
                  {setting?.expiry_enabled && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <label className="text-white text-xs font-mono font-medium uppercase tracking-wider">
                          Days:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={setting?.expiry_days || 30}
                          onChange={(e) => {
                            const days = parseInt(e.target.value);
                            if (!isNaN(days)) {
                              handleUpdateDays(typedProfileType, days);
                            }
                          }}
                          disabled={isSaving}
                          className="w-16 p-1 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono text-center text-sm"
                        />
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {[7, 30, 90, 365].map(days => (
                          <button
                            key={days}
                            onClick={() => handleUpdateDays(typedProfileType, days)}
                            disabled={isSaving}
                            className={`px-2 py-1 rounded font-mono text-xs uppercase tracking-wider transition-colors ${
                              setting?.expiry_days === days
                                ? 'bg-white text-black'
                                : 'bg-black border border-white text-white hover:bg-white/10 disabled:opacity-50'
                            }`}
                          >
                            {days}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageExpirySettings;