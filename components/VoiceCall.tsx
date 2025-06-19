import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPhone, 
  faPhoneSlash, 
  faMicrophone, 
  faMicrophoneSlash,
  faTimes,
  faVolumeUp
} from '@fortawesome/free-solid-svg-icons';
import { getAgoraInstance, generateChannelName } from '../lib/agora';

interface VoiceCallProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { user_id: string; username: string; display_name?: string };
  otherUser: { user_id: string; username: string; display_name?: string };
  isIncoming?: boolean;
  onCallEnd?: () => void;
  callId?: string; // For incoming calls
}

export interface VoiceCallRef {
  handleCallAccepted: () => void;
  handleCallDeclined: () => void;
  handleCallEndedByOther: () => void;
  handleCallMissed: () => void;
}

const VoiceCall = forwardRef<VoiceCallRef, VoiceCallProps>(({
  isOpen,
  onClose,
  currentUser,
  otherUser,
  isIncoming = false,
  onCallEnd,
  callId
}, ref) => {
  const [callStatus, setCallStatus] = useState<'connecting' | 'calling' | 'connected' | 'ended' | 'failed' | 'incoming'>(
    isIncoming ? 'incoming' : 'calling' // Use 'calling' for outgoing calls, 'incoming' for incoming calls
  );
  const [connectionProgress, setConnectionProgress] = useState<string>(
    isIncoming ? 'Incoming call...' : 'Calling...'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [isAcceptingCall, setIsAcceptingCall] = useState(false); // Prevent multiple accepts
  const [activeCallId, setActiveCallId] = useState<string | null>(callId || null); // Track the active call ID
  
  const agoraRef = useRef(getAgoraInstance());
  const callStartTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const componentMountedRef = useRef(true);
  const notificationSentRef = useRef(false); // Track if notification was already sent
  const lastNotificationTimeRef = useRef(0); // Track last notification time for cooldown

  // Generate consistent channel name
  const channelName = generateChannelName(currentUser.user_id, otherUser.user_id);

  // Start call duration timer
  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) return;
    
    callStartTimeRef.current = new Date();
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000);
        setCallDuration(elapsed);
      }
    }, 1000);
  }, []);

  // Stop call duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Send call notification (for outgoing calls)
  const sendCallNotification = useCallback(async () => {
    const now = Date.now();
    const cooldownTime = 2000; // 2 second cooldown between calls
    
    console.log(`📞 sendCallNotification called, isStartingCall: ${isStartingCall}, notificationSent: ${notificationSentRef.current}, cooldown: ${now - lastNotificationTimeRef.current < cooldownTime}`);
    
    if (isStartingCall || notificationSentRef.current) {
      console.log('Call notification already being sent or sent, ignoring duplicate request');
      return;
    }

    // Check cooldown period
    if (now - lastNotificationTimeRef.current < cooldownTime) {
      console.log(`Call notification too soon (${now - lastNotificationTimeRef.current}ms ago), ignoring request`);
      return;
    }

    try {
      setIsStartingCall(true);
      notificationSentRef.current = true; // Mark as sent
      lastNotificationTimeRef.current = now; // Record notification time
      setError(null);
      setConnectionProgress('Notifying recipient...');
      
      console.log(`📞 Sending call notification to ${otherUser.username}`);
      
      const response = await fetch('/api/voice-calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          recipient_id: otherUser.user_id,
          channel_name: channelName,
          call_type: 'voice'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to notify recipient: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('📞 Call notification sent, call_id:', result.call_id);
      setActiveCallId(result.call_id); // Store the call_id for later use
      setConnectionProgress('Calling... waiting for answer');
      
    } catch (notifyError: unknown) {
      console.error('❌ Failed to send call notification:', notifyError);
      setCallStatus('failed');
      setError('Failed to initiate call. Please try again.');
      notificationSentRef.current = false; // Reset on error so user can retry
    } finally {
      setIsStartingCall(false);
    }
  }, [isStartingCall, otherUser.username, otherUser.user_id, channelName]);

  // Initialize and start call (for Agora connection only)
  const startCall = useCallback(async (retryCount = 0) => {
    console.log(`🎯 startCall called with retryCount: ${retryCount}, isStartingCall: ${isStartingCall}`);
    
    if (isStartingCall && retryCount === 0) {
      console.log('Call already being started, ignoring duplicate request');
      return;
    }

    try {
      // Only show connecting UI on first attempt
      if (retryCount === 0) {
        setIsStartingCall(true);
        setError(null);
        setCallStatus('connecting');
        setConnectionProgress('Connecting to call...');
        
        // Log connection attempt
        console.log(`🎯 Starting Agora connection for call with ${otherUser.username} in channel: ${channelName}`);
      } else {
        console.log(`🔄 Retry attempt ${retryCount} for call with ${otherUser.username}`);
        setConnectionProgress(`Retrying connection (attempt ${retryCount + 1})...`);
      }
      
      // Perform microphone permission check (only on first attempt)
      if (retryCount === 0) {
        setConnectionProgress('Checking microphone permissions...');
        console.log('🎤 Checking microphone permissions...');
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('✅ Microphone access granted');
        } catch (permissionError: unknown) {
          console.error('❌ Media permission error:', permissionError);
          setCallStatus('failed');
          setError('Microphone access denied. Please grant microphone permission and try again.');
          setIsStartingCall(false);
          return;
        }
      }
      
      // If this is a retry, add a short delay to ensure cleanup is complete
      if (retryCount > 0) {
        setConnectionProgress('Preparing retry...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setConnectionProgress('Connecting to voice service...');
      console.log('🌐 Calling agoraRef.current.startCall...');
      const success = await agoraRef.current.startCall(channelName, currentUser.user_id);
      console.log(`🌐 Agora startCall result: ${success}`);
      
      if (!componentMountedRef.current) {
        console.log('⚠️ Component unmounted during call setup');
        return;
      }
      
      if (success) {
        setConnectionProgress('Connected successfully!');
        setCallStatus('connected');
        console.log('✅ Call connected successfully!');
        startDurationTimer();
      } else {
        setCallStatus('failed');
        setConnectionProgress('Connection failed');
        setError('Failed to connect to voice call. Please check your internet connection and try again.');
      }
    } catch (err: unknown) {
      if (!componentMountedRef.current) return; // Component unmounted
      
      // Type guard for error objects
      const error = err as Error & { code?: string; name?: string };
      
      // Check if this is a cancellation error (don't show as error to user)
      const isCancellation = error?.message?.includes('cancel') || 
                           error?.message?.includes('abort') ||
                           error?.code === 'OPERATION_CANCELED' ||
                           error?.name === 'AbortError';
                           
      // Check if this is an "already connected" error (potentially retryable)
      const isAlreadyConnectedError = error?.message?.includes('already in connecting') || 
                                    error?.message?.includes('already in connected') ||
                                    error?.message?.includes('INVALID_OPERATION: Client already in');

      if (isCancellation) {
        console.log('Call start was cancelled');
        setCallStatus('ended');
        onClose();
      } else if (isAlreadyConnectedError && retryCount < 2) {
        // For "already connected" errors, try to end the call and retry up to 2 times
        console.warn('Detected connection state issue, attempting recovery (retry:', retryCount + 1, ')');
        
        try {
          // Try to clean up first
          await agoraRef.current.endCall();
          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 1500));
          // Retry with incremented retry count
          return startCall(retryCount + 1);
        } catch (cleanupErr) {
          console.error('Failed to clean up before retry:', cleanupErr);
          setError('Connection error. Please try again in a few seconds.');
          setCallStatus('failed');
        }
      } else {
        // Provide more specific error messages based on the error type
        console.error('Error starting call:', error);
        setCallStatus('failed');
        
        // Handle common errors with user-friendly messages
        if (error.message?.includes('microphone') || error.message?.includes('audio')) {
          setError('Microphone access error. Please check your audio settings and try again.');
        } else if (error.message?.includes('timeout') || error.message?.includes('Connection timeout')) {
          setError('Connection timeout. This may be due to network issues or Agora configuration. Try refreshing the page.');
        } else if (error.message?.includes('token')) {
          setError('Authentication failed. Please refresh the page and try again.');
        } else if (isAlreadyConnectedError) {
          setError('Connection state error. Please try again in a few seconds.');
        } else {
          setError(`Failed to start voice call: ${error.message || 'Unknown error'}`);
        }
      }
    } finally {
      // Only reset the starting state if this wasn't a retry attempt
      // or if all retries are exhausted
      if (retryCount >= 2) {
        setIsStartingCall(false);
      }
    }
  }, [channelName, currentUser.user_id, startDurationTimer, isStartingCall, onClose, otherUser.username]);

  // End call
  const endCall = useCallback(async () => {
    try {
      await agoraRef.current.endCall();
      setCallStatus('ended');
      stopDurationTimer();
      
      // Send call end notification to the other participant
      try {
        console.log('📞 Sending call end notification to other participant');
        
        // For outgoing calls in "calling" state, this is a cancellation
        const status = (!isIncoming && callStatus === 'calling') ? 'missed' : 'ended';
        
        const response = await fetch('/api/voice-calls', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            call_id: activeCallId || callId || 'unknown',
            status: status,
            other_user_id: otherUser.user_id
          }),
        });
        
        if (response.ok) {
          console.log(`✅ Successfully notified other participant of call ${status}`);
        } else {
          console.warn(`⚠️ Failed to notify other participant of call ${status}:`, response.status);
        }
      } catch (notifyError) {
        console.warn('⚠️ Error sending call end notification:', notifyError);
        // Don't throw - we still want to end the call locally
      }
      
      console.log('Voice call ended');
      
      if (onCallEnd) {
        onCallEnd();
      }
      onClose();
    } catch (err) {
      console.error('Error ending call:', err);
      onClose();
    }
  }, [onCallEnd, onClose, stopDurationTimer, activeCallId, callId, otherUser.user_id, isIncoming, callStatus]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    try {
      if (isMuted) {
        await agoraRef.current.unmuteAudio();
      } else {
        await agoraRef.current.muteAudio();
      }
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Error toggling mute:', err);
    }
  }, [isMuted]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize call when component opens (only for outgoing calls)
  useEffect(() => {
    if (isOpen && !isIncoming && callStatus === 'calling' && !notificationSentRef.current) {
      // For outgoing calls, just send notification - don't join Agora channel yet
      sendCallNotification();
    }
  }, [isOpen, isIncoming, callStatus]); // Removed sendCallNotification from deps

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (isAcceptingCall) {
      console.log('Already accepting call, ignoring duplicate request');
      return;
    }
    
    setIsAcceptingCall(true);
    console.log('Accept call clicked, current status:', callStatus);
    
    // For incoming calls, notify the caller that the call was accepted
    if (isIncoming && (activeCallId || callId)) {
      try {
        const callIdToUse = activeCallId || callId;
        console.log('Accepting incoming call:', callIdToUse);
        const response = await fetch('/api/voice-calls', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            call_id: callIdToUse, 
            status: 'accepted' 
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to notify call acceptance:', response.status);
        } else {
          console.log('Successfully notified caller of call acceptance');
        }
      } catch (error) {
        console.error('Error notifying call acceptance:', error);
      }
    }
    
    // Reset state and start the actual Agora connection
    setCallStatus('connecting');
    setConnectionProgress('Connecting to call...');
    setError(null);
    setIsStartingCall(false); // Reset this flag to allow startCall to proceed
    
    try {
      // Start the actual call connection (Agora only)
      console.log('About to call startCall() for incoming call acceptance');
      await startCall();
      console.log('startCall() completed for incoming call acceptance');
    } catch (error) {
      console.error('Error in startCall during accept:', error);
      setCallStatus('failed');
      setError('Failed to connect to call');
    } finally {
      setIsAcceptingCall(false);
    }
  }, [startCall, isIncoming, activeCallId, callId, callStatus, isAcceptingCall]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    // For incoming calls, notify the caller that the call was declined
    if (isIncoming && (activeCallId || callId)) {
      try {
        const callIdToUse = activeCallId || callId;
        console.log('Declining incoming call:', callIdToUse);
        const response = await fetch('/api/voice-calls', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            call_id: callIdToUse, 
            status: 'declined' 
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to notify call decline:', response.status);
        } else {
          console.log('Successfully notified caller of call decline');
        }
      } catch (error) {
        console.error('Error notifying call decline:', error);
      }
    }
    
    setCallStatus('ended');
    onClose();
  }, [onClose, isIncoming, activeCallId, callId]);

  // Handle call accepted by recipient (for outgoing calls)
  const handleCallAccepted = useCallback(async () => {
    console.log('📞 Call was accepted by recipient, joining channel...');
    setCallStatus('connecting');
    setConnectionProgress('Recipient answered, connecting...');
    setIsStartingCall(false); // Reset this to allow joining
    
    try {
      // Now join the Agora channel since the call was accepted
      setConnectionProgress('Connecting to voice service...');
      const success = await agoraRef.current.startCall(channelName, currentUser.user_id);
      
      if (success) {
        setConnectionProgress('Connected successfully!');
        setCallStatus('connected');
        console.log('✅ Call connected after acceptance!');
        startDurationTimer();
      } else {
        setCallStatus('failed');
        setError('Failed to connect to voice call. Please try again.');
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error connecting after call acceptance:', err);
      setCallStatus('failed');
      setError(`Failed to connect: ${err.message || 'Unknown error'}`);
    }
  }, [channelName, currentUser.user_id, startDurationTimer]);

  // Handle call declined by recipient (for outgoing calls)
  const handleCallDeclined = useCallback(() => {
    console.log('📞 Call was declined by recipient');
    setCallStatus('ended');
    setConnectionProgress('Call declined');
    setError('Call was declined');
    onClose();
  }, [onClose]);

  // Handle call missed/cancelled by caller (for incoming calls)
  const handleCallMissed = useCallback(() => {
    console.log('📞 Call was cancelled by caller');
    setCallStatus('ended');
    setConnectionProgress('Call cancelled');
    setError('Call was cancelled');
    onClose();
  }, [onClose]);

  // Handle call ended by other participant (for both incoming and outgoing calls)
  const handleCallEndedByOther = useCallback(async () => {
    console.log('📞 Call was ended by other participant');
    
    try {
      // End the Agora call without sending another notification
      await agoraRef.current.endCall();
      setCallStatus('ended');
      setConnectionProgress('Call ended');
      stopDurationTimer();
      
      if (onCallEnd) {
        onCallEnd();
      }
      onClose();
    } catch (error) {
      console.error('Error ending call after other participant ended:', error);
      onClose();
    }
  }, [onClose, onCallEnd, stopDurationTimer]);

  // Expose handlers to parent component
  useImperativeHandle(ref, () => ({
    handleCallAccepted,
    handleCallDeclined,
    handleCallEndedByOther,
    handleCallMissed
  }), [handleCallAccepted, handleCallDeclined, handleCallEndedByOther, handleCallMissed]);

  // Connection timeout failsafe
  useEffect(() => {
    if (callStatus === 'connecting') {
      const timeout = setTimeout(() => {
        if (callStatus === 'connecting') {
          console.warn('Connection timeout reached, failing call');
          setCallStatus('failed');
          setError('Connection timeout. Please check your internet connection and try again.');
          setConnectionProgress('Connection timed out');
        }
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [callStatus]);

  // Add an effect to monitor and restore SSE connections during calls
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    // Monitor SSE connection status during calls
    const monitorSSE = () => {
      if (typeof window === 'undefined') return;
      
      // Check if window has SSE connection status
      const sseConnected = (window as Window & { __sseConnected?: boolean }).__sseConnected;
      if (sseConnected === false) {
        console.log('🔄 VoiceCall: Detected SSE disconnection during call, requesting reconnection...');
        // Dispatch a custom event to request SSE reconnection
        window.dispatchEvent(new CustomEvent('requestSSEReconnection'));
      }
    };

    const sseMonitorInterval = setInterval(monitorSSE, 3000);

    return () => {
      clearInterval(sseMonitorInterval);
    };
  }, [isOpen]);

  // Cleanup on unmount and when component closes
  useEffect(() => {
    componentMountedRef.current = true;
    
    return () => {
      componentMountedRef.current = false;
      notificationSentRef.current = false; // Reset notification flag on unmount
      stopDurationTimer();
      if (agoraRef.current.getConnectionStatus() || agoraRef.current.getConnectingStatus()) {
        agoraRef.current.endCall().catch((err) => {
          // Ignore cancellation errors during cleanup
          if (!err?.message?.includes('cancel') && !err?.message?.includes('abort')) {
            console.error('Error during cleanup:', err);
          }
        });
      }
    };
  }, [stopDurationTimer]);

  // Cleanup when modal is closed
  useEffect(() => {
    if (!isOpen) {
      componentMountedRef.current = false;
      // Only reset notification flag after a delay to prevent immediate re-sending
      setTimeout(() => {
        notificationSentRef.current = false;
      }, 1000);
      stopDurationTimer();
      if (agoraRef.current.getConnectionStatus() || agoraRef.current.getConnectingStatus()) {
        agoraRef.current.endCall().catch((err) => {
          // Ignore cancellation errors during cleanup
          if (!err?.message?.includes('cancel') && !err?.message?.includes('abort')) {
            console.error('Error during cleanup:', err);
          }
        });
      }
    } else {
      componentMountedRef.current = true;
    }
  }, [isOpen, stopDurationTimer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-black border-2 border-white rounded-none shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="border-b-2 border-white bg-white text-black p-4 text-center">
          <h2 className="font-mono text-lg uppercase tracking-wider">
            {isIncoming ? 'INCOMING CALL' : 'VOICE CALL'}
          </h2>
        </div>

        {/* Call Content */}
        <div className="p-6 text-white text-center space-y-6">
          {/* User Info */}
          <div className="space-y-3">
            <div className="w-20 h-20 bg-gray-700 border-2 border-white rounded-none mx-auto flex items-center justify-center">
              <FontAwesomeIcon icon={faPhone} className="text-2xl text-white" />
            </div>
            <div>
              <h3 className="font-mono text-lg uppercase tracking-wider">
                {otherUser.display_name || otherUser.username}
              </h3>
              <p className="font-mono text-sm text-gray-400 uppercase">
                {callStatus === 'connecting' && connectionProgress}
                {callStatus === 'connected' && formatDuration(callDuration)}
                {callStatus === 'failed' && 'CALL FAILED'}
                {callStatus === 'ended' && 'CALL ENDED'}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900 border border-red-500 p-3 rounded-none">
              <p className="font-mono text-sm mb-2">{error}</p>
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    setError(null);
                    setCallStatus('connecting');
                    startCall();
                  }}
                  className="bg-white text-black px-3 py-1 text-xs font-mono hover:bg-gray-200 rounded"
                >
                  RETRY
                </button>
              </div>
            </div>
          )}

          {/* Call Status */}
          <div className="font-mono text-sm space-y-2">
            {callStatus === 'incoming' && (
              <div className="text-blue-400">
                <FontAwesomeIcon icon={faPhone} className="animate-pulse mr-2" />
                INCOMING CALL
              </div>
            )}
            {callStatus === 'connecting' && (
              <div className="text-yellow-400">
                <FontAwesomeIcon icon={faPhone} className="animate-pulse mr-2" />
                {connectionProgress.toUpperCase()}
              </div>
            )}
            {callStatus === 'connected' && (
              <div className="text-green-400">
                <FontAwesomeIcon icon={faVolumeUp} className="mr-2" />
                CALL ACTIVE
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex justify-center space-x-4">
            {/* Outgoing call controls (calling state) */}
            {!isIncoming && callStatus === 'calling' && (
              <button
                onClick={endCall}
                className="p-4 bg-red-600 hover:bg-red-700 border-2 border-red-400 rounded-none transition-colors"
                title="Cancel Call"
              >
                <FontAwesomeIcon icon={faPhoneSlash} className="text-white text-xl" />
              </button>
            )}

            {/* Incoming call controls */}
            {isIncoming && (callStatus === 'incoming' || callStatus === 'connecting') && (
              <>
                <button
                  onClick={acceptCall}
                  className="p-4 bg-green-600 hover:bg-green-700 border-2 border-green-400 rounded-none transition-colors"
                  title="Accept Call"
                >
                  <FontAwesomeIcon icon={faPhone} className="text-white text-xl" />
                </button>
                <button
                  onClick={declineCall}
                  className="p-4 bg-red-600 hover:bg-red-700 border-2 border-red-400 rounded-none transition-colors"
                  title="Decline Call"
                >
                  <FontAwesomeIcon icon={faPhoneSlash} className="text-white text-xl" />
                </button>
              </>
            )}

            {/* Active call controls */}
            {callStatus === 'connected' && (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-4 border-2 rounded-none transition-colors ${
                    isMuted 
                      ? 'bg-red-600 hover:bg-red-700 border-red-400' 
                      : 'bg-gray-600 hover:bg-gray-700 border-gray-400'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <FontAwesomeIcon 
                    icon={isMuted ? faMicrophoneSlash : faMicrophone} 
                    className="text-white text-xl" 
                  />
                </button>
                <button
                  onClick={endCall}
                  className="p-4 bg-red-600 hover:bg-red-700 border-2 border-red-400 rounded-none transition-colors"
                  title="End Call"
                >
                  <FontAwesomeIcon icon={faPhoneSlash} className="text-white text-xl" />
                </button>
              </>
            )}

            {/* Failed/ended call controls */}
            {(callStatus === 'failed' || callStatus === 'ended') && (
              <button
                onClick={onClose}
                className="p-4 bg-gray-600 hover:bg-gray-700 border-2 border-gray-400 rounded-none transition-colors"
                title="Close"
              >
                <FontAwesomeIcon icon={faTimes} className="text-white text-xl" />
              </button>
            )}
          </div>
        </div>

        {/* Close button for non-critical states */}
        {callStatus !== 'connected' && (
          <div className="absolute top-4 right-4">
            <button
              onClick={onClose}
              className="text-black hover:text-gray-600 transition-colors font-mono text-xl"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

VoiceCall.displayName = 'VoiceCall';

export default VoiceCall;
