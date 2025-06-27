import { useState, useCallback, useEffect } from 'react';
import { useCSRFToken } from './useCSRFToken';

type ProfileType = 'basic' | 'love' | 'business';

interface MessageExpirySettings {
  user_id: string;
  profile_type: ProfileType;
  expiry_enabled: boolean;
  expiry_days: number;
  created_at: string;
  updated_at: string;
}

interface UseMessageExpiryReturn {
  settings: Record<ProfileType, MessageExpirySettings>;
  loading: boolean;
  error: string;
  updateSetting: (profileType: ProfileType, enabled: boolean, days: number) => Promise<boolean>;
  fetchSettings: () => Promise<void>;
}

export const useMessageExpiry = (): UseMessageExpiryReturn => {
  const { protectedFetch } = useCSRFToken();
  const [settings, setSettings] = useState<Record<ProfileType, MessageExpirySettings>>({} as Record<ProfileType, MessageExpirySettings>);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSettings = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      const response = await protectedFetch('/api/profile/message-expiry');
      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
      } else {
        setError(data.message || 'Failed to fetch expiry settings');
      }
    } catch (err) {
      console.error('Error fetching message expiry settings:', err);
      setError('Failed to fetch expiry settings');
    } finally {
      setLoading(false);
    }
  }, [protectedFetch]);

  const updateSetting = useCallback(async (
    profileType: ProfileType, 
    enabled: boolean, 
    days: number
  ): Promise<boolean> => {
    try {
      setError('');

      const response = await protectedFetch('/api/profile/message-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_type: profileType,
          expiry_enabled: enabled,
          expiry_days: days
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setSettings(prev => ({
          ...prev,
          [profileType]: {
            ...prev[profileType],
            expiry_enabled: enabled,
            expiry_days: days,
            updated_at: new Date().toISOString()
          }
        }));
        return true;
      } else {
        setError(data.message || 'Failed to update expiry setting');
        return false;
      }
    } catch (err) {
      console.error('Error updating message expiry setting:', err);
      setError('Failed to update expiry setting');
      return false;
    }
  }, [protectedFetch]);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSetting,
    fetchSettings
  };
};