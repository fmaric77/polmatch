import { useState, useCallback } from 'react';

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
}

export const useGroupManagement = (currentUser: { user_id: string; username: string } | null) => {
  const [groupChannels, setGroupChannels] = useState<Channel[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [bannedUsers, setBannedUsers] = useState<{ user_id: string; username: string; banned_at: string; reason: string }[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  const fetchChannels = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/channels`);
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
  }, []);

  const fetchGroupMembers = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const data = await res.json();
      if (data.success) {
        setGroupMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    }
  }, []);

  const fetchBannedUsers = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/banned`);
      const data = await res.json();
      if (data.success) {
        setBannedUsers(data.banned_users || []);
      }
    } catch (err) {
      console.error('Failed to fetch banned users:', err);
      setBannedUsers([]);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations');
      const data = await res.json();
      if (data.success) {
        setInvitations(data.invitations);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  }, []);

  const fetchAvailableUsers = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/users/available?group_id=${groupId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch available users:', err);
    }
  }, []);

  const createChannel = useCallback(async (groupId: string, channelData: { name: string; description: string }) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelData)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error creating channel:', err);
      return { success: false, error: 'Failed to create channel' };
    }
  }, []);

  const deleteChannel = useCallback(async (groupId: string, channelId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/channels/${channelId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error deleting channel:', error);
      return { success: false, error: 'Failed to delete channel' };
    }
  }, []);

  const inviteUser = useCallback(async (groupId: string, userId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited_user_id: userId })
      });
      const data = await res.json();
      return data;
    } catch {
      return { success: false, error: 'Failed to send invitation' };
    }
  }, []);

  const respondToInvitation = useCallback(async (invitationId: string, action: 'accept' | 'decline') => {
    try {
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to respond to invitation:', err);
      return { success: false, error: 'Failed to respond to invitation' };
    }
  }, []);

  const removeGroupMember = useCallback(async (groupId: string, userId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to remove group member:', err);
      return { success: false, error: 'Failed to remove member' };
    }
  }, []);

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
    bannedUsers,
    setBannedUsers,
    availableUsers,
    setAvailableUsers,
    fetchChannels,
    fetchGroupMembers,
    fetchBannedUsers,
    fetchInvitations,
    fetchAvailableUsers,
    createChannel,
    deleteChannel,
    inviteUser,
    respondToInvitation,
    removeGroupMember,
    canManageMembers,
    canManageMember,
    canPromoteToAdmin
  };
};