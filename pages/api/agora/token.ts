import type { NextApiRequest, NextApiResponse } from 'next';
import { validateSession } from '../../../lib/auth';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

interface TokenResponse {
  token: string | null;
  channelName: string;
  uid: string;
  expiresIn: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenResponse | { error: string }>
) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract the session token from cookie
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const sessionToken = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized: No session token' });
    }
    
    // Validate the session
    const sessionResult = await validateSession(sessionToken);
    if (!sessionResult.valid || !sessionResult.session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    }

    // Get request body
    const { channelName, uid } = req.body;
    if (!channelName || !uid) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get Agora app ID and certificate from environment variables
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId) {
      return res.status(500).json({ error: 'Server configuration error: Missing Agora App ID' });
    }

    if (!appCertificate) {
      return res.status(500).json({ error: 'Server configuration error: Missing Agora Certificate' });
    }

    try {
      // Calculate privilege expire time (1 hour from now)
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      console.log('Generating Agora token for:', { channelName, uid });

      // Build the token using string user account (for UUIDs)
      const token = RtcTokenBuilder.buildTokenWithUserAccount(
        appId,
        appCertificate,
        channelName,
        uid, // Use string UID directly for UUIDs
        RtcRole.PUBLISHER,
        0, // tokenType (0 for RTC)
        privilegeExpiredTs
      );

      console.log('Successfully generated Agora token');

      // Return the real token
      return res.status(200).json({
        token,
        channelName,
        uid,
        expiresIn: expirationTimeInSeconds
      });
    } catch (tokenError) {
      console.error('Error generating Agora token:', tokenError);
      return res.status(500).json({ error: 'Failed to generate authentication token' });
    }
  } catch (error) {
    console.error('Error generating Agora token:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
}
