import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../lib/mongodb-connection';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface PinnedMessage {
  message_id: string;
  content: string;
  sender_id: string;
  pinned_by?: string;
  pinned_at: string;
  is_pinned: boolean;
  timestamp: string;
  channel_id: string;
  group_id: string;
}

interface UserProfile {
  user_id: string;
  display_name: string;
  profile_picture_url?: string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = request.cookies;
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const url = new URL(request.url);
    const channelId = url.searchParams.get('channel_id');
    const profile_type = url.searchParams.get('profile_type') || 'basic';

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const { db } = await connectToDatabase();

    // Check if user is a member of the group in any profile collection
    const memberCollections = ['group_members', 'group_members_love', 'group_members_business'];
    let membership = null;
    
    for (const collection of memberCollections) {
      membership = await db.collection(collection).findOne({
        group_id: groupId,
        user_id: auth.userId
      });
      if (membership) break;
    }

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Search for pinned messages in all group message collections
    const messageCollections = ['group_messages', 'group_messages_love', 'group_messages_business'];
    let pinnedMessages: PinnedMessage[] = [];
    
    for (const collection of messageCollections) {
      const messages = await db.collection(collection)
        .find({
          group_id: groupId,
          ...(channelId && { channel_id: channelId }),
          is_pinned: true
        })
        .sort({ pinned_at: -1 }) // Most recently pinned first
        .project({
          message_id: 1,
          sender_id: 1,
          content: 1,
          timestamp: 1,
          is_pinned: 1,
          pinned_at: 1,
          pinned_by: 1,
          message_type: 1,
          poll_data: 1,
          attachments: 1,
          reply_to: 1
        })
        .toArray();
      
      pinnedMessages = [...pinnedMessages, ...messages as PinnedMessage[]];
    }

    // Sort all pinned messages by pinned_at descending
    pinnedMessages.sort((a, b) => new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime());

    // Get sender display names for the pinned messages
    const senderIds = [...new Set(pinnedMessages.map((msg: PinnedMessage) => msg.sender_id))];
    const pinnerIds = [...new Set(pinnedMessages.map((msg: PinnedMessage) => msg.pinned_by).filter(Boolean))];
    const allUserIds = [...new Set([...senderIds, ...pinnerIds])];

    // Use profile-specific collection for display names
    const profilesCollection = profile_type === 'basic' ? 'basicprofiles' : `${profile_type}profiles`;
    const profiles = await db.collection(profilesCollection).find({
      user_id: { $in: allUserIds }
    }).project({
      user_id: 1,
      display_name: 1,
      profile_picture_url: 1
    }).toArray();

    const profileMap = new Map((profiles as UserProfile[]).map((profile: UserProfile) => [profile.user_id, profile]));

    // Enhance messages with sender and pinner information AND decrypt content
    const enhancedMessages = pinnedMessages.map((message: PinnedMessage) => {
      // Decrypt the content
      let decryptedContent = message.content;
      try {
        if (message.content) {
          const bytes = CryptoJS.AES.decrypt(message.content, SECRET_KEY);
          decryptedContent = bytes.toString(CryptoJS.enc.Utf8);
        }
      } catch (error) {
        console.error('Error decrypting message content:', error);
        // If decryption fails, keep original content
      }

      return {
        ...message,
        content: decryptedContent,
        sender_display_name: profileMap.get(message.sender_id)?.display_name || '[NO PROFILE NAME]',
        sender_profile_picture: profileMap.get(message.sender_id)?.profile_picture_url,
        pinned_by_display_name: message.pinned_by ? profileMap.get(message.pinned_by)?.display_name || '[NO PROFILE NAME]' : null
      };
    });

    return NextResponse.json({
      success: true,
      pinned_messages: enhancedMessages
    });

  } catch (error) {
    console.error('Error fetching pinned messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
