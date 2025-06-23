import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../../lib/mongodb-connection';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { notifyNewGroupMessage } from '../../../../../lib/sse-notifications';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface PollOption {
  option_id: string;
  text: string;
}

interface GroupPoll {
  poll_id: string;
  group_id: string;
  creator_id: string;
  question: string;
  options: PollOption[];
  created_at: string;
  expires_at?: string;
  is_expired?: boolean;
}

// GET: list polls for a group
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { db } = await connectToDatabase();
  const groupId = (await params).id;
  const polls = await db.collection('group_polls').find({ group_id: groupId }).toArray();
  
  // Check and update expired polls
  const now = new Date();
  const pollsWithExpiry = polls.map(poll => ({
    ...poll,
    is_expired: poll.expires_at ? now > new Date(poll.expires_at) : false
  }));
  
  return NextResponse.json({ success: true, polls: pollsWithExpiry });
}

// POST: create a new poll in a group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const { db } = await connectToDatabase();
  const session = await db.collection('sessions').findOne({ sessionToken });
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { question, options, expires_in_hours, profile_type = 'basic', channel_id } = await req.json();
  if (!question || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ success: false, message: 'Question and at least two options required' }, { status: 400 });
  }

  // Validate profile_type
  if (!['basic', 'love', 'business'].includes(profile_type)) {
    return NextResponse.json({ 
      success: false, 
      message: 'Invalid profile_type. Must be basic, love, or business' 
    }, { status: 400 });
  }
  
  const groupId = (await params).id;
  
  // Use profile-specific collections
  const messagesCollection = profile_type === 'basic' ? 'group_messages' : `group_messages_${profile_type}`;
  const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
  
  // Check if user is a member of the group
  const membership = await db.collection(membersCollection).findOne({
    group_id: groupId,
    user_id: session.user_id
  });

  if (!membership) {
    return NextResponse.json({ 
      success: false, 
      message: 'Not a member of this group' 
    }, { status: 403 });
  }
  
  const pollId = uuidv4();
  const now = new Date();
  
  // Calculate expiry date if provided
  let expiresAt: string | undefined;
  if (expires_in_hours && typeof expires_in_hours === 'number' && expires_in_hours > 0) {
    const expiryDate = new Date(now.getTime() + (expires_in_hours * 60 * 60 * 1000));
    expiresAt = expiryDate.toISOString();
  }
  
  const pollDoc: GroupPoll = {
    poll_id: pollId,
    group_id: groupId,
    creator_id: session.user_id,
    question,
    options: options.map((text: string) => ({ option_id: uuidv4(), text })),
    created_at: now.toISOString(),
    ...(expiresAt && { expires_at: expiresAt })
  };
  
  await db.collection('group_polls').insertOne(pollDoc);
  
  // Get user profile information for the message
  const userProfileCollection = profile_type === 'basic' ? 'basicprofiles' : `${profile_type}profiles`;
  const userProfile = await db.collection(userProfileCollection).findOne(
    { user_id: session.user_id },
    { projection: { display_name: 1 } }
  );
  
  const user = await db.collection('users').findOne(
    { user_id: session.user_id },
    { projection: { username: 1 } }
  );
  
  // Create a poll message artifact in the group chat using the correct profile-specific collection
  const messageId = uuidv4();
  const messageContent = `📊 **Poll Created:** ${question}`;
  const encryptedContent = CryptoJS.AES.encrypt(messageContent, SECRET_KEY).toString();
  
  const pollMessage = {
    message_id: messageId,
    group_id: groupId,
    sender_id: session.user_id,
    content: encryptedContent,
    timestamp: now.toISOString(),
    edited: false,
    attachments: [],
    is_pinned: false,
    message_type: 'poll',
    sender_username: user?.username || 'Unknown',
    sender_display_name: userProfile?.display_name || '[NO PROFILE NAME]',
    poll_data: {
      poll_id: pollId,
      question,
      options: pollDoc.options,
      expires_at: expiresAt
    },
    profile_type,
    ...(channel_id && { channel_id }) // Include channel_id if creating poll in a specific channel
  };
  
  // Store poll message in the correct profile-specific collection
  console.log('📝 Storing poll message in collection:', messagesCollection);
  console.log('📝 Poll message data:', JSON.stringify(pollMessage, null, 2));
  await db.collection(messagesCollection).insertOne(pollMessage);
  console.log('✅ Poll message stored successfully');
  
  // Send SSE notification to notify group members about the new poll message
  try {
    await notifyNewGroupMessage({
      message_id: messageId,
      group_id: groupId,
      channel_id: channel_id,
      sender_id: session.user_id,
      content: question, // Use the poll question as the content
      timestamp: now.toISOString(),
      attachments: [],
      sender_username: user?.username || 'Unknown',
      sender_display_name: userProfile?.display_name || '[NO PROFILE NAME]',
      profile_type
    });
    console.log('🔔 SSE notification sent for new poll message');
  } catch (error) {
    console.error('❌ Failed to send SSE notification for poll:', error);
  }
  
  return NextResponse.json({ success: true, poll: pollDoc, message: pollMessage, profile_type });
}