import { useState, useEffect, useCallback } from 'react';
import { useCSRFToken } from './useCSRFToken';

export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

interface UserStatusData {
  status: UserStatus;
  custom_message?: string;
  last_seen?: string;
}

interface StatusChangeEvent {
  user_id: string;
  username: string;
  status: UserStatus;
  custom_message?: string;
  timestamp: string;
}

export const useUserStatus = (currentUser: { user_id: string; username: string } | null) => {
  const { protectedFetch } = useCSRFToken();
  const [currentStatus, setCurrentStatus] = useState<UserStatusData>({
    status: 'offline'
  });
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatusData>>(new Map());
  const [loading, setLoading] = useState(false);

  // Note: fetchCurrentStatus removed as it was unused - status is fetched in initialization effect

  // Fetch status for a specific user
  const fetchUserStatus = useCallback(async (userId: string): Promise<UserStatusData | null> => {
    try {
      const response = await fetch(`/api/users/status?user_id=${userId}`);
      const data = await response.json();

      if (data.success) {
        const statusData: UserStatusData = {
          status: data.status,
          custom_message: data.custom_message,
          last_seen: data.last_seen
        };
        
        // Update local cache
        setUserStatuses(prev => new Map(prev).set(userId, statusData));
        return statusData;
      }
    } catch (error) {
      console.error('Error fetching user status:', error);
    }
    return null;
  }, []);

  // Update current user's status
  const updateStatus = useCallback(async (status: UserStatus, customMessage?: string): Promise<boolean> => {
    if (!currentUser) return false;

    // Optimistic update - update UI immediately
    const previousStatus = currentStatus;
    const newStatus = {
      status,
      custom_message: customMessage,
      last_seen: new Date().toISOString()
    };
    setCurrentStatus(newStatus);

    try {
      setLoading(true);
      const response = await protectedFetch('/api/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          custom_message: customMessage 
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update with server response (in case server modified anything)
        setCurrentStatus({
          status: data.status,
          custom_message: data.custom_message,
          last_seen: data.last_seen
        });
        return true;
      } else {
        // Revert to previous status on failure
        setCurrentStatus(previousStatus);
        return false;
      }
    } catch (error) {
      console.error('Error updating status:', error);
      // Revert to previous status on error
      setCurrentStatus(previousStatus);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, protectedFetch, currentStatus]);

  // Set user to offline (called on disconnect)
  const setOffline = useCallback(async (): Promise<void> => {
    if (!currentUser) return;

    try {
      await protectedFetch('/api/users/status', {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error setting offline status:', error);
    }
  }, [currentUser, protectedFetch]);

  // Handle SSE status change events
  const handleStatusChange = useCallback((event: StatusChangeEvent) => {
    console.log('🟢 Status change received via SSE:', event);
    
    const statusData: UserStatusData = {
      status: event.status,
      custom_message: event.custom_message,
      last_seen: event.timestamp
    };

    if (event.user_id === currentUser?.user_id) {
      // Update current user status only if it's different (avoid unnecessary re-renders)
      setCurrentStatus(prev => {
        if (prev.status !== event.status || prev.custom_message !== event.custom_message) {
          console.log('🟢 Updating current user status via SSE:', statusData);
          return statusData;
        }
        return prev;
      });
    } else {
      // Update other user status
      setUserStatuses(prev => {
        const current = prev.get(event.user_id);
        // Only update if status actually changed
        if (!current || current.status !== event.status || current.custom_message !== event.custom_message) {
          console.log('🟢 Updating other user status via SSE:', event.user_id, statusData);
          return new Map(prev).set(event.user_id, statusData);
        }
        return prev;
      });
    }
  }, [currentUser]);

  // Get status for a user (from cache or fetch if needed)
  const getUserStatus = useCallback((userId: string): UserStatusData | null => {
    // For current user, return their own status
    if (currentUser && userId === currentUser.user_id) {
      return currentStatus;
    }
    // For other users, return from cache
    return userStatuses.get(userId) || null;
  }, [userStatuses, currentUser, currentStatus]);

  // Batch fetch statuses for multiple users
  const fetchMultipleUserStatuses = useCallback(async (userIds: string[]): Promise<void> => {
    const promises = userIds.map(userId => fetchUserStatus(userId));
    await Promise.all(promises);
  }, [fetchUserStatus]);

  // Get status display info
  const getStatusDisplay = useCallback((status: UserStatus) => {
    switch (status) {
      case 'online':
        return { color: '#22c55e', label: 'Online', icon: '🟢' };
      case 'away':
        return { color: '#fbbf24', label: 'Away', icon: '🟡' };
      case 'dnd':
        return { color: '#ef4444', label: 'Do Not Disturb', icon: '🔴' };
      case 'offline':
      default:
        return { color: '#6b7280', label: 'Offline', icon: '⚫' };
    }
  }, []);

  // Initialize status on mount
  useEffect(() => {
    if (currentUser) {
      // First fetch the current status from server
      const initializeStatus = async () => {
        try {
          const response = await fetch('/api/users/status');
          const data = await response.json();

          if (data.success) {
            const fetchedStatus = {
              status: data.status,
              custom_message: data.custom_message,
              last_seen: data.last_seen
            };
            
            setCurrentStatus(fetchedStatus);
            
            // Only set to online if the user was offline (don't override other statuses)
            if (data.status === 'offline') {
              updateStatus('online');
            }
          } else {
            // If fetch fails, default to online
            updateStatus('online');
          }
        } catch (error) {
          console.error('Error fetching initial status:', error);
          // If fetch fails, default to online
          updateStatus('online');
        }
      };
      
      initializeStatus();
    }
  }, [currentUser]);

  // Handle page visibility changes (away/online) - only if user is currently online
  useEffect(() => {
    if (!currentUser) return;

    const handleVisibilityChange = () => {
      // Only auto-change status if user is currently online or away
      // Don't override DND or offline status
      if (currentStatus.status === 'online' || currentStatus.status === 'away') {
        if (document.hidden) {
          // User switched away from tab - only change to away if they were online
          if (currentStatus.status === 'online') {
            updateStatus('away');
          }
        } else {
          // User returned to tab - only change to online if they were away
          if (currentStatus.status === 'away') {
            updateStatus('online');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set offline on page unload
    const handleBeforeUnload = () => {
      setOffline();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser, updateStatus, setOffline, currentStatus.status]);

  return {
    currentStatus,
    userStatuses,
    loading,
    updateStatus,
    setOffline,
    fetchUserStatus,
    fetchMultipleUserStatuses,
    getUserStatus,
    getStatusDisplay,
    handleStatusChange
  };
}; 