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

  const handleToggleExpiry = async (profileType: ProfileType, enabled: boolean) => {
    setSaving(profileType);
    setSuccessMessage('');
    
    const currentDays = settings[profileType]?.expiry_days || 30;
    const success = await updateSetting(profileType, enabled, currentDays);
    
    if (success) {
      setSuccessMessage(`${profileType.charAt(0).toUpperCase() + profileType.slice(1)} profile expiry ${enabled ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccessMessage(''), 3000);
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
      setSuccessMessage(`${profileType.charAt(0).toUpperCase() + profileType.slice(1)} profile expiry period updated`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
    
    setSaving(null);
  };

  const getProfileDisplayName = (profileType: ProfileType): string => {
    switch (profileType) {
      case 'basic': return 'General';
      case 'love': return 'Love';
      case 'business': return 'Business';
      default: return profileType;
    }
  };

  const getProfileIcon = (profileType: ProfileType): string => {
    switch (profileType) {
      case 'basic': return '👤';
      case 'love': return '💕';
      case 'business': return '💼';
      default: return '📱';
    }
  };

  if (loading) {
    return (
      <div className={`bg-black/40 border border-white/30 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8 font-mono uppercase tracking-wider text-white/60">
          Loading message expiry settings...
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/40 border border-white/30 rounded-lg p-6 ${className}`}>
      <h2 className="text-xl font-mono font-bold mb-6 uppercase tracking-wider text-white flex items-center">
        ⏱️ Message Auto-Delete Settings
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-600/20 border border-red-500/50 rounded text-red-400 font-mono text-sm">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-600/20 border border-green-500/50 rounded text-green-400 font-mono text-sm">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(settings).map(([profileType, setting]) => {
          const typedProfileType = profileType as ProfileType;
          const isSaving = saving === typedProfileType;
          
          return (
            <div 
              key={profileType} 
              className="bg-black/60 border border-white/20 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getProfileIcon(typedProfileType)}</span>
                  <div>
                    <h3 className="text-lg font-mono font-semibold text-white uppercase tracking-wider">
                      {getProfileDisplayName(typedProfileType)} Profile
                    </h3>
                    <p className="text-sm text-white/60 font-mono">
                      Auto-delete your sent messages after a specified period
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={setting?.expiry_enabled || false}
                      onChange={(e) => handleToggleExpiry(typedProfileType, e.target.checked)}
                      disabled={isSaving}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white peer-disabled:opacity-50"></div>
                  </label>
                  
                  {isSaving && (
                    <div className="text-white/60 font-mono text-sm">Saving...</div>
                  )}
                </div>
              </div>
              
              {setting?.expiry_enabled && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="text-white text-sm font-mono font-medium uppercase tracking-wider">
                      Delete messages after:
                    </label>
                    <div className="flex items-center space-x-2">
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
                        className="w-20 p-2 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono text-center"
                      />
                      <span className="text-white font-mono text-sm">days</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {[7, 14, 30, 60, 90, 180, 365].map(days => (
                      <button
                        key={days}
                        onClick={() => handleUpdateDays(typedProfileType, days)}
                        disabled={isSaving}
                        className={`px-3 py-1 rounded font-mono text-xs uppercase tracking-wider transition-colors ${
                          setting?.expiry_days === days
                            ? 'bg-white text-black'
                            : 'bg-black border border-white text-white hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-xs text-white/60 font-mono bg-black/40 p-3 rounded border border-white/10">
                    ⚠️ Only messages you send will be auto-deleted. Messages from others will remain unless they also have expiry enabled.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 text-sm text-white/60 font-mono bg-black/40 p-4 rounded border border-white/10">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span>🔄</span>
            <span>Messages are automatically deleted once per day</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🔒</span>
            <span>Each profile has independent expiry settings</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>📝</span>
            <span>Only your sent messages are affected by these settings</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageExpirySettings;