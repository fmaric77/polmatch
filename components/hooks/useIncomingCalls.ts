import { useState, useEffect, useCallback } from 'react';

interface IncomingCall {
  call_id: string;
  caller: {
    user_id: string;
    username: string;
    display_name?: string;
  };
  channel_name: string;
  call_type: 'voice' | 'video';
  created_at: string;
}

export const useIncomingCalls = (sessionToken: string | null) => {
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  // Check for incoming calls with debouncing
  const checkIncomingCalls = useCallback(async () => {
    if (!sessionToken || isChecking) return;
    
    // Prevent too frequent requests (minimum 5 seconds between checks)
    const now = Date.now();
    if (now - lastCheckTime < 5000) return;

    setIsChecking(true);
    setLastCheckTime(now);
    
    try {
      const response = await fetch('/api/voice-calls');
      const data = await response.json();

      if (data.success && data.calls) {
        setIncomingCalls(data.calls);
      }
    } catch (error) {
      console.error('Error checking incoming calls:', error);
    } finally {
      setIsChecking(false);
    }
  }, [sessionToken, isChecking, lastCheckTime]);

  // Accept a call
  const acceptCall = useCallback(async (callId: string) => {
    try {
      const response = await fetch('/api/voice-calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          status: 'accepted'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Remove the call from incoming calls
        setIncomingCalls(prev => prev.filter(call => call.call_id !== callId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error accepting call:', error);
      return false;
    }
  }, []);

  // Decline a call
  const declineCall = useCallback(async (callId: string) => {
    try {
      const response = await fetch('/api/voice-calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          status: 'declined'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Remove the call from incoming calls
        setIncomingCalls(prev => prev.filter(call => call.call_id !== callId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error declining call:', error);
      return false;
    }
  }, []);

  // End a call
  const endCall = useCallback(async (callId: string) => {
    try {
      const response = await fetch('/api/voice-calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          status: 'ended'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Remove the call from incoming calls
        setIncomingCalls(prev => prev.filter(call => call.call_id !== callId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error ending call:', error);
      return false;
    }
  }, []);

  // Poll for incoming calls with intelligent frequency and visibility detection
  useEffect(() => {
    if (!sessionToken) return;

    let interval: NodeJS.Timeout;
    let isTabVisible = true;
    
    // Track tab visibility to reduce polling when tab is not visible
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // More aggressive polling (every 10 seconds) if we have active calls or tab is visible
    // Less aggressive polling (every 60 seconds) if no active calls and tab is hidden
    const getPollingInterval = () => {
      if (incomingCalls.length > 0) return 10000; // 10 seconds if active calls
      if (isTabVisible) return 30000; // 30 seconds if tab visible
      return 120000; // 2 minutes if tab hidden
    };
    
    const scheduleNextCheck = () => {
      interval = setTimeout(() => {
        checkIncomingCalls().then(() => {
          scheduleNextCheck(); // Schedule the next check
        });
      }, getPollingInterval());
    };
    
    // Check immediately
    checkIncomingCalls().then(() => {
      scheduleNextCheck();
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (interval) {
        clearTimeout(interval);
      }
    };
  }, [sessionToken, checkIncomingCalls, incomingCalls.length]);

  return {
    incomingCalls,
    acceptCall,
    declineCall,
    endCall,
    checkIncomingCalls
  };
};
