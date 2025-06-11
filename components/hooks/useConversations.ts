import { useState, useCallback } from 'react';

interface User {
  user_id: string;
  username: string;
}

interface Conversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  is_private?: boolean;
  last_message?: string;
  last_activity?: string;
  unread_count?: number;
  members_count?: number;
  user_id?: string;
  creator_id?: string;
  user_role?: string;
}

interface PrivateConversationFromAPI {
  id: string;
  created_at: string;
  updated_at: string;
  latest_message?: {
    content: string;
    timestamp: string;
  };
  other_user: User;
  current_user_id: string;
}

interface Group {
  _id?: string;
  group_id: string;
  name: string;
  description: string;
  creator_id: string;
  creation_date: string;
  is_private: boolean;
  members_count: number;
  topic: string;
  status: string;
  last_activity: string;
  user_role?: string;
}

export const useConversations = (currentUser: { user_id: string; username: string } | null, profileType?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;

    try {
      console.log('Fetching conversations for user:', currentUser.user_id, 'profile type:', profileType);
      
      // Build URL with optional profile type filter
      let dmsUrl = '/api/private-conversations';
      if (profileType) {
        dmsUrl += `?profile_type=${profileType}`;
      }
      
      // Fetch DMs and groups in parallel
      const [dmsRes, groupsRes] = await Promise.all([
        fetch(dmsUrl),
        fetch('/api/groups/list')
      ]);

      const [dmsData, groupsData] = await Promise.all([
        dmsRes.json(),
        groupsRes.json()
      ]);

      const dmConversations: Conversation[] = [];
      const groupConversations: Conversation[] = [];

      // Process DM conversations
      if (dmsData.success && Array.isArray(dmsData.conversations)) {
        dmsData.conversations.forEach((conv: PrivateConversationFromAPI) => {
          if (conv.other_user) {
            dmConversations.push({
              id: conv.other_user.user_id,
              name: conv.other_user.username,
              type: 'direct' as const,
              user_id: conv.other_user.user_id,
              last_message: conv.latest_message?.content,
              last_activity: conv.latest_message?.timestamp || conv.created_at,
              unread_count: 0
            });
          }
        });
      }

      // Process group conversations
      if (groupsData.success && groupsData.groups) {
        groupsData.groups.forEach((group: Group) => {
          groupConversations.push({
            id: group.group_id,
            name: group.name,
            type: 'group',
            is_private: group.is_private,
            last_activity: group.last_activity,
            members_count: group.members_count,
            creator_id: group.creator_id,
            user_role: group.user_role,
            unread_count: 0
          });
        });
      }

      // Sort by last activity
      const allConversations = [...dmConversations, ...groupConversations].sort((a, b) => 
        new Date(b.last_activity || 0).getTime() - new Date(a.last_activity || 0).getTime()
      );
      
      setConversations(allConversations);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
      setLoading(false);
    }
  }, [currentUser]);

  const deleteConversation = useCallback(async (conv: Conversation) => {
    if (conv.type === 'direct') {
      // Use the correct private-conversations DELETE endpoint
      // Include profile type if available, otherwise the backend will delete from all collections
      const deletePayload: { other_user_id: string; sender_profile_type?: string; receiver_profile_type?: string } = {
        other_user_id: conv.id
      };
      
      // Add profile type context if available (defaulting to 'basic' for consistency)
      if (profileType) {
        deletePayload.sender_profile_type = profileType;
        deletePayload.receiver_profile_type = 'basic'; // Assume basic for receiver unless we have more context
      }
      
      const response = await fetch('/api/private-conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletePayload)
      });
      
      if (response.ok) {
        setConversations(prev => prev.filter(c => !(c.id === conv.id && c.type === 'direct')));
      } else {
        console.error('Failed to delete conversation:', await response.text());
      }
    } else if (conv.type === 'group') {
      const response = await fetch(`/api/groups/${conv.id}`, { method: 'DELETE' });
      if (response.ok) {
        setConversations(prev => prev.filter(c => !(c.id === conv.id && c.type === 'group')));
      } else {
        console.error('Failed to delete group:', await response.text());
      }
    }
  }, [profileType]);

  return {
    conversations,
    setConversations,
    loading,
    error,
    setError,
    fetchConversations,
    deleteConversation
  };
};