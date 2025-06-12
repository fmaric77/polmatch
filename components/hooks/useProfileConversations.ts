import { useState, useCallback, useEffect } from 'react';

type ProfileType = 'basic' | 'love' | 'business';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
  profile_picture_url?: string;
}

interface ProfileConversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  profile_type: ProfileType;
  other_user?: User;
  last_message?: {
    content: string;
    timestamp: string;
    sender_id: string;
  };
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

export const useProfileConversations = (
  currentUser: { user_id: string; username: string } | null,
  profileType: ProfileType
) => {
  const [conversations, setConversations] = useState<ProfileConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchConversations = useCallback(async () => {
    if (!currentUser) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const res = await fetch(`/api/conversations/profile?profile_type=${profileType}`);
      const data = await res.json();

      if (data.success) {
        setConversations(data.conversations || []);
      } else {
        console.error('Failed to fetch profile conversations:', data.message);
        setError(data.message || 'Failed to fetch conversations');
        setConversations([]);
      }
    } catch (err) {
      console.error('Error fetching profile conversations:', err);
      setError('Failed to fetch conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, profileType]);

  // Fetch conversations when user or profile type changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations
  };
};
