// Agora voice calling utilities
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ILocalVideoTrack, ILocalAudioTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { csrfFetch } from './csrf-client';

export interface AgoraConfig {
  appId: string;
  token?: string;
}

export interface CallParticipant {
  userId: string;
  username: string;
  displayName?: string;
}

export interface VoiceCallSession {
  channelName: string;
  participants: CallParticipant[];
  startTime: Date;
  status: 'connecting' | 'connected' | 'ended' | 'failed';
}

class AgoraVoiceCall {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private localScreenVideoTrack: ILocalVideoTrack | null = null;
  private localScreenAudioTrack: ILocalAudioTrack | null = null;
  private remoteScreenHandler: ((userId: string, track: IRemoteVideoTrack | null) => void) | null = null;
  private volumeIndicatorHandler: ((updates: Array<{ uid: string; level: number }>) => void) | null = null;
  private appId: string;
  private currentChannel: string | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private currentConnectionPromise: Promise<boolean> | null = null;
  private lastCallEndTime: number = 0;

  constructor(appId: string) {
    this.appId = appId;
    
    // Check if Agora SDK is available
    if (typeof AgoraRTC === 'undefined') {
      throw new Error('Agora RTC SDK not loaded. Please ensure the Agora SDK is properly included.');
    }
    
    try {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      console.log('Agora client created successfully');
    } catch (createError) {
      console.error('Failed to create Agora client:', createError);
      throw new Error('Failed to initialize voice call system. Please refresh the page and try again.');
    }
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    // Enable SDK volume indicator (default interval ~200ms)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (AgoraRTC as any).enableAudioVolumeIndicator?.();
    } catch {}

    this.client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      if (!this.client) return;
      console.log('[Agora] user-published', { uid: user.uid, mediaType });
      await this.client.subscribe(user, mediaType).catch(err => {
        console.warn('[Agora] subscribe failed', err);
      });
      if (mediaType === 'audio') {
        const audioTrack = user.audioTrack;
        if (audioTrack) {
          audioTrack.play();
        }
      } else if (mediaType === 'video') {
        const videoTrack = user.videoTrack;
        if (videoTrack) {
          console.log('[Agora] received remote video track, invoking handler');
          if (this.remoteScreenHandler) {
            this.remoteScreenHandler(String(user.uid), videoTrack as IRemoteVideoTrack);
          }
        } else {
          console.log('[Agora] video mediaType but no videoTrack present');
        }
      }
    });

    this.client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      console.log('[Agora] user-unpublished', { uid: user.uid, mediaType });
      if (mediaType === 'video') {
        if (this.remoteScreenHandler) {
          this.remoteScreenHandler(String(user.uid), null);
        }
      }
    });

    // Audio volume indicators for speaking detection
    this.client.on('volume-indicator', (volumes: Array<{ uid: string | number; level: number }>) => {
      if (this.volumeIndicatorHandler) {
        const updates = volumes.map(v => ({ uid: String(v.uid), level: v.level }));
        this.volumeIndicatorHandler(updates);
      }
    });

    this.client.on('user-left', (user: IAgoraRTCRemoteUser) => {
      console.log('User disconnected:', user.uid);
    });
  }

  setRemoteScreenHandler(handler: ((userId: string, track: IRemoteVideoTrack | null) => void) | null): void {
    this.remoteScreenHandler = handler;
    // If a handler is set and a remote video track already exists, notify immediately
    if (handler && this.client) {
      try {
        const users = this.client.remoteUsers || [];
        for (const u of users) {
          // If the user already has a video track, surface it now
          const vt = (u as IAgoraRTCRemoteUser).videoTrack as IRemoteVideoTrack | null | undefined;
          if (vt) {
            handler(String(u.uid), vt);
            break;
          }
        }
      } catch (e) {
        console.log('[Agora] error scanning existing remote users for video track', e);
      }
    }
  }

  setVolumeIndicatorHandler(handler: ((updates: Array<{ uid: string; level: number }>) => void) | null): void {
    this.volumeIndicatorHandler = handler;
  }

  async startScreenShare(withSystemAudio: boolean = false): Promise<boolean> {
    if (!this.client) throw new Error('Agora client not initialized');
    if (!this.isConnected || this.client.connectionState !== 'CONNECTED') {
      console.warn('[Agora] startScreenShare requested while not connected');
      throw new Error('Not connected to a channel');
    }
    if (this.localScreenVideoTrack) {
      console.log('Screen share already active');
      return true;
    }

    try {
      console.log('🔳 Creating screen video track...');
  const result = await AgoraRTC.createScreenVideoTrack({ encoderConfig: '720p' as const }, withSystemAudio ? 'auto' : 'disable');
      let videoTrack: ILocalVideoTrack;
      let audioTrack: ILocalAudioTrack | null = null;

      if (Array.isArray(result)) {
        // [videoTrack, audioTrack]
        videoTrack = result[0];
        audioTrack = result[1] || null;
      } else {
        videoTrack = result;
      }

  console.log('[Agora] Publishing screen share tracks', { withAudio: !!audioTrack });
  await this.client.publish(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);
      this.localScreenVideoTrack = videoTrack;
      this.localScreenAudioTrack = audioTrack;
      console.log('✅ Screen share published');
      return true;
    } catch (err) {
      const error = err as Error;
      console.error('Failed to start screen share:', error);
      return false;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.client) return;
    const tracks: Array<ILocalVideoTrack | ILocalAudioTrack> = [];
    if (this.localScreenVideoTrack) tracks.push(this.localScreenVideoTrack);
    if (this.localScreenAudioTrack) tracks.push(this.localScreenAudioTrack);
    if (tracks.length > 0) {
      try {
        await this.client.unpublish(tracks);
      } catch (unpubErr) {
        console.warn('Error unpublishing screen share tracks:', unpubErr);
      }
    }
    try {
      if (this.localScreenVideoTrack) this.localScreenVideoTrack.close();
      if (this.localScreenAudioTrack) this.localScreenAudioTrack.close();
    } catch {}
    this.localScreenVideoTrack = null;
    this.localScreenAudioTrack = null;
    console.log('🛑 Screen share stopped');
  }

  async startCall(channelName: string, userId: string, token?: string): Promise<boolean> {
    console.log(`🎯 Agora.startCall called with channel: ${channelName}, user: ${userId}, token: ${token ? 'provided' : 'none'}`);
    console.log(`🎯 Current Agora state - connected: ${this.isConnected}, connecting: ${this.isConnecting}`);
    
    // Prevent rapid successive calls (add 1 second cooldown)
    const now = Date.now();
    if (now - this.lastCallEndTime < 1000) {
      console.log('Call attempt too soon after previous call, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.lastCallEndTime)));
    }

    // If there's already a connection attempt in progress, wait for it or cancel it
    if (this.currentConnectionPromise) {
      console.log('Connection attempt already in progress, waiting for completion...');
      try {
        await this.currentConnectionPromise;
      } catch {
        console.log('Previous connection attempt failed, proceeding with new one');
      }
    }

    // Create a new connection promise
    console.log('🌐 Creating new connection promise...');
    this.currentConnectionPromise = this._performConnection(channelName, userId, token);
    
    try {
      console.log('🌐 Awaiting connection...');
      const result = await this.currentConnectionPromise;
      console.log(`🌐 Connection result: ${result}`);
      this.currentConnectionPromise = null;
      return result;
    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.currentConnectionPromise = null;
      throw error;
    }
  }

  private async _performConnection(channelName: string, userId: string, token?: string): Promise<boolean> {
    console.log(`🔧 _performConnection started - channel: ${channelName}, user: ${userId}`);
    
    try {
      if (!this.client) {
        throw new Error('Agora client not initialized');
      }

      console.log(`🔧 Current client state: ${this.client.connectionState}`);
      console.log(`🔧 Current flags - isConnected: ${this.isConnected}, isConnecting: ${this.isConnecting}`);

      // Check all possible connection states more rigorously
      const clientState = this.client.connectionState;
      if (this.isConnected || this.isConnecting || 
          clientState === 'CONNECTING' || 
          clientState === 'CONNECTED' ||
          clientState === 'RECONNECTING') {
        
        console.log(`🔧 Already in ${clientState} state, ending previous call first`);
        await this.endCall();
        
        // Wait for cleanup to complete
        console.log('🔧 Waiting for previous connection to be fully cleared...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Double-check state after waiting
        if (this.isConnected || this.isConnecting || this.client.connectionState !== 'DISCONNECTED') {
          console.warn('🔧 Client still not in DISCONNECTED state after cleanup, forcing reset');
          // Force a client reset if needed
          this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
          this.setupEventHandlers();
        }
      }
      
      console.log('🔧 Setting isConnecting = true');
      this.isConnecting = true;
      
      // Fetch a token if none was provided (recommended for production)
      let finalToken = token;
      if (!finalToken) {
        try {
          // Try to fetch token from server
          console.log('No token provided, attempting to fetch from server...');
          const response = await csrfFetch('/api/agora/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channelName,
              uid: userId,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            finalToken = data.token;
            console.log('Successfully fetched authentication token');
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.warn(`Failed to fetch token: ${errorData.error || response.status}`);
            throw new Error(`Failed to fetch authentication token: ${errorData.error || response.status}`);
          }
        } catch (tokenError: unknown) {
          const error = tokenError instanceof Error ? tokenError : new Error('Unknown token error');
          console.warn('Error fetching token:', error);
          throw new Error(`Failed to fetch required Agora token: ${error.message}`);
        }
      }

      console.log(`🔧 Joining channel ${channelName} with ${finalToken ? 'token' : 'no token'}`);
      console.log('🔧 Client state before join:', this.client.connectionState);
      console.log('🔧 Agora App ID:', this.appId);
      
      // Add timeout wrapper for join operation with proper cleanup
      const joinPromise = this.client.join(this.appId, channelName, finalToken || null, userId);
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.error('❌ Join operation timed out after 15 seconds');
          console.error('❌ Channel:', channelName, 'User ID:', userId, 'Token present:', !!finalToken);
          reject(new Error('Connection timeout: Failed to join channel within 15 seconds. This may indicate a network issue or authentication problem.'));
        }, 15000);
      });
      
      console.log('🔧 Attempting to join channel...');
      try {
        // Race between join and timeout
        await Promise.race([joinPromise, timeoutPromise]);
        // Clear timeout if join succeeds first
        clearTimeout(timeoutId!);
        console.log('✅ Successfully joined channel, client state:', this.client.connectionState);
      } catch (joinError: unknown) {
        // Clear timeout on any error
        clearTimeout(timeoutId!);
        const error = joinError instanceof Error ? joinError : new Error('Unknown join error');
        console.error('❌ Join operation failed:', error);
        console.error('❌ Join operation failed:', error);
        // Check for specific Agora errors
        if ((error as Error & { code?: string }).code === 'INVALID_PARAMS' || error.message?.includes('INVALID_PARAMS')) {
          throw new Error('Invalid connection parameters. Please check your configuration.');
        } else if ((error as Error & { code?: string }).code === 'INVALID_OPERATION' || error.message?.includes('INVALID_OPERATION')) {
          throw new Error('Connection state error. Please try again.');
        } else if (error.message?.includes('timeout')) {
          throw new Error('Connection timeout. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      console.log('🔧 Setting connection flags...');
      this.currentChannel = channelName;
      this.isConnected = true;
      this.isConnecting = false;

      // Create and publish local audio track with timeout
      try {
        console.log('🎤 Creating microphone audio track...');
        const micPromise = AgoraRTC.createMicrophoneAudioTrack();
        let micTimeoutId: NodeJS.Timeout;
        const micTimeoutPromise = new Promise<never>((_, reject) => {
          micTimeoutId = setTimeout(() => reject(new Error('Microphone timeout: Failed to access microphone within 10 seconds')), 10000);
        });
        
        const micResult = await Promise.race([micPromise, micTimeoutPromise]);
        clearTimeout(micTimeoutId!);
        this.localAudioTrack = micResult as IMicrophoneAudioTrack;
        console.log('✅ Microphone audio track created successfully');
      } catch (micError) {
        console.error('❌ Microphone access error:', micError);
        throw new Error('Could not access microphone. Please check permissions and try again.');
      }
      
      // Publish with timeout
      console.log('📡 Publishing audio track...');
      const publishPromise = this.client.publish([this.localAudioTrack]);
      let publishTimeoutId: NodeJS.Timeout;
      const publishTimeoutPromise = new Promise<never>((_, reject) => {
        publishTimeoutId = setTimeout(() => reject(new Error('Publish timeout: Failed to publish audio track within 10 seconds')), 10000);
      });
      
      await Promise.race([publishPromise, publishTimeoutPromise]);
      clearTimeout(publishTimeoutId!);
      console.log('✅ Audio track published successfully');

      console.log('🎉 Successfully joined voice call:', channelName);
      return true;
    } catch (catchError: unknown) {
      this.isConnecting = false;
      
      const error = catchError instanceof Error ? catchError : new Error('Unknown connection error');
      
      // Check if this is a cancellation error (should be handled gracefully)
      const isCancellation = error?.message?.includes('cancel') || 
                           error?.message?.includes('abort') ||
                           (error as Error & { code?: string })?.code === 'OPERATION_CANCELED' ||
                           error?.name === 'AbortError';

      // Check if this is an "already connected" error
      const isAlreadyConnectedError = error?.message?.includes('already in connecting') || 
                                    error?.message?.includes('already in connected') ||
                                    error?.message?.includes('INVALID_OPERATION: Client already in');
      
      if (isCancellation) {
        console.log('Connection attempt was cancelled');
        // Don't log as error, this is expected behavior
        return false;
      } else if (isAlreadyConnectedError) {
        console.warn('Received already connected error, attempting to recover connection');
        
        // If we're getting "already connected" but our state doesn't match,
        // we should try to fix the inconsistency
        if (!this.isConnected) {
          console.log('State inconsistency detected, fixing...');
          this.isConnected = true;
          this.currentChannel = channelName;
        }
        
        // Return true since we're already connected
        return true;
      } else if (error?.message?.includes('timeout') || error?.message?.includes('Connection timeout')) {
        console.error('Connection timeout detected');
      }

      console.error('Failed to start voice call:', error);
      
      // Always clean up consistently after an error
      try {
        await this.endCall();
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      } finally {
        // Ensure state is reset regardless of cleanup success
        this.isConnected = false;
        this.isConnecting = false;
      }
      
      return false;
    }
  }

  async endCall(): Promise<void> {
    try {
      // Cancel any ongoing connection attempt
      if (this.currentConnectionPromise) {
        console.log('Cancelling ongoing connection attempt');
        this.currentConnectionPromise = null;
      }
      
      // Stop and close local audio track
      if (this.localAudioTrack) {
        try {
          this.localAudioTrack.stop();
          this.localAudioTrack.close();
        } catch (trackError) {
          console.log('Error closing audio track (likely already closed):', trackError);
        }
        this.localAudioTrack = null;
      }

      // Stop screen share tracks if active
      if (this.localScreenVideoTrack || this.localScreenAudioTrack) {
        await this.stopScreenShare().catch(() => {});
      }

      // Leave the channel if client exists
      if (this.client) {
        const clientState = this.client.connectionState;
        console.log(`Ending call with client state: ${clientState}`);
        
        // Always try to unpublish tracks before leaving
        if (clientState === 'CONNECTED') {
          try {
            await this.client.unpublish();
            console.log('Unpublished all tracks');
          } catch (unpublishError: unknown) {
            // Don't throw error, just log
            const error = unpublishError instanceof Error ? unpublishError : new Error('Unknown unpublish error');
            console.log('Error unpublishing tracks (continuing):', error.message);
          }
        }
        
        // Only try to leave if in a state where it makes sense
        if (clientState !== 'DISCONNECTED') {
          try {
            await this.client.leave();
            console.log('Successfully left channel');
          } catch (leaveError: unknown) {
            const error = leaveError instanceof Error ? leaveError : new Error('Unknown leave error');
            // Ignore cancellation and already-disconnected errors
            if (!error?.message?.includes('cancel') && 
                !error?.message?.includes('abort') && 
                !error?.message?.includes('not in channel')) {
              console.error('Error leaving channel:', error);
            } else {
              console.log('Ignoring expected error during channel leave:', error.message);
            }
          }
        }
      }

      // Reset state
      this.isConnected = false;
      this.isConnecting = false;
      this.currentChannel = null;
      this.lastCallEndTime = Date.now();

      console.log('Voice call ended');
    } catch (catchError: unknown) {
      const error = catchError instanceof Error ? catchError : new Error('Unknown cleanup error');
      // Check if this is a cancellation error
      const isCancellation = error?.message?.includes('cancel') || 
                           error?.message?.includes('abort') ||
                           (error as Error & { code?: string })?.code === 'OPERATION_CANCELED';

      if (!isCancellation) {
        console.error('Error ending voice call:', error);
      }
      
      // Force reset state even if operations fail
      this.isConnected = false;
      this.isConnecting = false;
      this.currentChannel = null;
      this.currentConnectionPromise = null;
      
      if (this.localAudioTrack) {
        try {
          this.localAudioTrack.close();
        } catch {}
        this.localAudioTrack = null;
      }
    }
  }

  async muteAudio(): Promise<void> {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setMuted(true);
    }
  }

  async unmuteAudio(): Promise<void> {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setMuted(false);
    }
  }

  isAudioMuted(): boolean {
    return this.localAudioTrack ? this.localAudioTrack.muted : false;
  }

  getCurrentChannel(): string | null {
    return this.currentChannel;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getConnectingStatus(): boolean {
    return this.isConnecting;
  }
}

// Global instance
let agoraInstance: AgoraVoiceCall | null = null;

export const getAgoraInstance = (): AgoraVoiceCall => {      // Get Agora app ID and validate
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        throw new Error('NEXT_PUBLIC_AGORA_APP_ID environment variable is not set');
      }
      
      // Validate App ID format (should be 32 characters)
      if (appId.length !== 32) {
        console.warn('Agora App ID may be invalid - expected 32 characters, got:', appId.length);
      }

      if (!agoraInstance) {
        console.log('Creating new Agora instance with App ID:', appId.substring(0, 8) + '...');
        agoraInstance = new AgoraVoiceCall(appId);
      }

  return agoraInstance;
};

// Utility functions
export const generateChannelName = (userId1: string, userId2: string): string => {
  // Create a consistent channel name regardless of order
  const sortedIds = [userId1, userId2].sort();
  
  // Remove hyphens and limit length to stay within 64 byte limit
  // Use a hash of the user IDs to ensure uniqueness while keeping it short
  const cleanId1 = sortedIds[0].replace(/-/g, '').substring(0, 16);
  const cleanId2 = sortedIds[1].replace(/-/g, '').substring(0, 16);
  
  // Create a simple hash for consistency
  const combined = cleanId1 + cleanId2;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Return a channel name that's Agora-compliant (alphanumeric, under 64 bytes)
  return `voice${Math.abs(hash).toString(36)}${cleanId1.substring(0, 8)}`;
};

export const generateCallId = (): string => {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
