import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const client = new MongoClient(MONGODB_URI);

// Send invitation to join a private group
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { invited_user_id } = await request.json();
    if (!invited_user_id) {
      return NextResponse.json({ success: false, message: 'Missing invited_user_id' }, { status: 400 });
    }

    const resolvedParams = await params;
    const group_id = resolvedParams.id;
    const inviter_id = session.user_id;

    // Check if group exists and is private
    const group = await db.collection('groups').findOne({ group_id });
    if (!group) {
      return NextResponse.json({ success: false, message: 'Group not found' }, { status: 404 });
    }

    if (!group.is_private) {
      return NextResponse.json({ success: false, message: 'Can only invite to private groups' }, { status: 400 });
    }

    // Check if inviter is a member of the group (and optionally has permission to invite)
    const inviterMembership = await db.collection('group_members').findOne({ 
      group_id, 
      user_id: inviter_id 
    });
    if (!inviterMembership) {
      return NextResponse.json({ success: false, message: 'You must be a member to invite others' }, { status: 403 });
    }

    // Check if invited user exists
    const invitedUser = await db.collection('users').findOne({ user_id: invited_user_id });
    if (!invitedUser) {
      return NextResponse.json({ success: false, message: 'Invited user not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await db.collection('group_members').findOne({ 
      group_id, 
      user_id: invited_user_id 
    });
    if (existingMembership) {
      return NextResponse.json({ success: false, message: 'User is already a member' }, { status: 400 });
    }

    // Check if invitation already exists
    const existingInvitation = await db.collection('group_invitations').findOne({ 
      group_id, 
      invited_user_id,
      status: 'pending'
    });
    if (existingInvitation) {
      return NextResponse.json({ success: false, message: 'Invitation already sent' }, { status: 400 });
    }

    // Create invitation
    const invitation = {
      invitation_id: uuidv4(),
      group_id,
      group_name: group.name,
      inviter_id,
      inviter_username: session.username || 'Unknown',
      invited_user_id,
      invited_username: invitedUser.username,
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    await db.collection('group_invitations').insertOne(invitation);

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      invitation_id: invitation.invitation_id
    });

  } catch (error) {
    console.error('Error sending group invitation:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
}
