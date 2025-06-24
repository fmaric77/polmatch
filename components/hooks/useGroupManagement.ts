import { useState, useCallback, useRef } from 'react';
import { useCSRFToken } from './useCSRFToken';

interface Channel {
  channel_id: string;
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
  is_default: boolean;
  position: number;
}

interface GroupMember {
  user_id: string;
  username: string;
  display_name?: string;
  role: string;
  join_date: string;
}

interface GroupInvitation {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_id: string;
  inviter_username: string;
  invited_user_id: string;
  created_at: string;
  status: string;
}

interface User {
  user_id: string;
  username: string;
  display_name?: string;
}

export const useGroupManagement = (currentUser: { user_id: string; username: string } | null, profileType?: string) => {
  const { protectedFetch } = useCSRFToken();
  const [groupChannels, setGroupChannels] = useState<Channel[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [invitationSummary, setInvitationSummary] = useState<Record<string, number>>({});
  const [bannedUsers, setBannedUsers] = useState<{ user_id: string; username: string; banned_at: string; banned_by: string; banned_by_username: string; reason: string }[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Debouncing ref for fetchAvailableUsers to prevent API spamming
  const fetchAvailableUsersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChannels = useCallback(async (groupId: string) => {
    try {
      const profileParam = profileType ? `?profile_type=${profileType}` : '';
      const res = await fetch(`/api/groups/${groupId}/channels${profileParam}`);
      const data = await res.json();
      if (data.success) {
        setGroupChannels(data.channels);
        return data.channels;
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      return [];
    }
  }, [profileType]);

  const fetchGroupMembers = useCallback(async (groupId: string) => {
    try {
      const profileParam = profileType ? `?profile_type=${profileType}` : '';
      const res = await fetch(`/api/groups/${groupId}/members${profileParam}`);
      const data = await res.json();
      if (data.success) {
        setGroupMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    }
  }, [profileType]);

  const fetchBannedUsers = useCallback(async (groupId: string) => {
    try {
      const profileParam = profileType ? `?profile_type=${profileType}` : '';
      const res = await fetch(`/api/groups/${groupId}/banned${profileParam}`);
      const data = await res.json();
      if (data.success) {
        setBannedUsers(data.banned_users || []);
      }
    } catch (err) {
      console.error('Failed to fetch banned users:', err);
      setBannedUsers([]);
    }
  }, [profileType]);

  const fetchInvitations = useCallback(async () => {
    try {
      console.log('🔔 Fetching invitations for profile type:', profileType);
      const res = await fetch(`/api/invitations?profile_type=${profileType}`);
      const data = await res.json();
      if (data.success) {
        console.log('🔔 Found invitations:', data.invitations.length);
        setInvitations(data.invitations);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  }, [profileType]);

  const fetchInvitationSummary = useCallback(async () => {
    try {
      console.log('🔔 Fetching invitation summary across all profile types');
      const res = await fetch('/api/invitations/summary');
      const data = await res.json();
      if (data.success) {
        console.log('🔔 Invitation summary:', data.summary);
        setInvitationSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch invitation summary:', err);
    }
  }, []);

  const fetchAvailableUsers = useCallback(async (groupId: string) => {
    // Clear any existing timeout to debounce rapid successive calls
    if (fetchAvailableUsersTimeoutRef.current) {
      clearTimeout(fetchAvailableUsersTimeoutRef.current);
    }

    // Debounce the API call by 300ms to prevent spamming
    fetchAvailableUsersTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Fetching available users for group:', groupId); // Debug log
        const res = await fetch(`/api/users/available?group_id=${groupId}&profile_type=${profileType}`);
        const data = await res.json();
        if (data.success) {
          setAvailableUsers(data.users);
        }
      } catch (err) {
        console.error('Failed to fetch available users:', err);
      }
    }, 300);
  }, [profileType]);

  const createChannel = useCallback(async (groupId: string, channelData: { name: string; description: string }) => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...channelData,
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error creating channel:', err);
      return { success: false, error: 'Failed to create channel' };
    }
  }, [protectedFetch, profileType]);

  const deleteChannel = useCallback(async (groupId: string, channelId: string) => {
    try {
      const profileParam = profileType ? `?profile_type=${profileType}` : '';
      const res = await protectedFetch(`/api/groups/${groupId}/channels/${channelId}${profileParam}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error deleting channel:', error);
      return { success: false, error: 'Failed to delete channel' };
    }
  }, [protectedFetch, profileType]);

  const inviteUser = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          invited_user_id: userId,
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      
      if (data.success) {
        // Refresh available users list after successful invitation
        await fetchAvailableUsers(groupId);
        return true;
      } else {
        console.error('Failed to send invitation:', data.message);
        return false;
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      return false;
    }
  }, [protectedFetch, fetchAvailableUsers, profileType]);

  const respondToInvitation = useCallback(async (invitationId: string, action: 'accept' | 'decline'): Promise<boolean> => {
    try {
      const res = await protectedFetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action,
          profile_type: profileType 
        })
      });
      const data = await res.json();
      
      if (data.success) {
        // Refresh invitations list after successful response
        await fetchInvitations();
        return true;
      } else {
        console.error('Failed to respond to invitation:', data.message);
        return false;
      }
    } catch (err) {
      console.error('Failed to respond to invitation:', err);
      return false;
    }
  }, [protectedFetch, fetchInvitations]);

  const removeGroupMember = useCallback(async (groupId: string, userId: string) => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/members/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId,
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to remove group member:', err);
      return { success: false, error: 'Failed to remove member' };
    }
  }, [protectedFetch, profileType]);

  const promoteToAdmin = useCallback(async (groupId: string, userId: string) => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/members/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId, 
          role: 'admin',
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to promote member:', err);
      return { success: false, error: 'Failed to promote member' };
    }
  }, [protectedFetch, profileType]);

  const demoteToMember = useCallback(async (groupId: string, userId: string) => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/members/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId, 
          role: 'member',
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to demote member:', err);
      return { success: false, error: 'Failed to demote member' };
    }
  }, [protectedFetch, profileType]);

  const banMember = useCallback(async (groupId: string, userId: string, reason?: string) => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/members/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId, 
          reason: reason || '',
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to ban member:', err);
      return { success: false, error: 'Failed to ban member' };
    }
  }, [protectedFetch, profileType]);

  const unbanMember = useCallback(async (groupId: string, userId: string) => {
    try {
      const res = await protectedFetch(`/api/groups/${groupId}/members/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId,
          ...(profileType && { profile_type: profileType })
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to unban member:', err);
      return { success: false, error: 'Failed to unban member' };
    }
  }, [protectedFetch, profileType]);

  // Permission checking functions
  const canManageMembers = useCallback((groupId: string): boolean => {
    if (!currentUser || !groupId) return false;
    
    const currentUserMember = groupMembers.find(m => m.user_id === currentUser.user_id);
    if (!currentUserMember) return false;
    
    return currentUserMember.role === 'admin' || currentUserMember.role === 'owner';
  }, [currentUser, groupMembers]);

  const canManageMember = useCallback((member: GroupMember): boolean => {
    if (!currentUser || !canManageMembers('')) return false;
    
    if (member.user_id === currentUser.user_id) return false;
    
    const currentUserMember = groupMembers.find(m => m.user_id === currentUser.user_id);
    if (!currentUserMember) return false;
    
    if (currentUserMember.role === 'owner') {
      return member.role !== 'owner';
    }
    
    if (currentUserMember.role === 'admin') {
      return member.role === 'member';
    }
    
    return false;
  }, [currentUser, groupMembers, canManageMembers]);

  const canPromoteToAdmin = useCallback((): boolean => {
    if (!currentUser) return false;
    
    const currentUserMember = groupMembers.find(m => m.user_id === currentUser.user_id);
    if (!currentUserMember) return false;
    
    return currentUserMember.role === 'owner';
  }, [currentUser, groupMembers]);

  return {
    groupChannels,
    setGroupChannels,
    groupMembers,
    setGroupMembers,
    invitations,
    setInvitations,
    invitationSummary,
    setInvitationSummary,
    bannedUsers,
    setBannedUsers,
    availableUsers,
    setAvailableUsers,
    fetchChannels,
    fetchGroupMembers,
    fetchBannedUsers,
    fetchInvitations,
    fetchInvitationSummary,
    fetchAvailableUsers,
    createChannel,
    deleteChannel,
    inviteUser,
    respondToInvitation,
    removeGroupMember,
    promoteToAdmin,
    demoteToMember,
    banMember,
    unbanMember,
    canManageMembers,
    canManageMember,
    canPromoteToAdmin
  };
};