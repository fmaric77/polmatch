import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-connection';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { invited_user_id, profile_type } = await request.json();
    if (!invited_user_id) {
      return NextResponse.json({ success: false, message: 'Missing invited_user_id' }, { status: 400 });
    }

    // Default to basic if not specified, validate profile_type
    const groupProfileType = profile_type || 'basic';
    if (!['basic', 'love', 'business'].includes(groupProfileType)) {
      return NextResponse.json({ success: false, message: 'Invalid profile_type. Must be basic, love, or business' }, { status: 400 });
    }

    // Use profile-specific collections
    const groupsCollection = groupProfileType === 'basic' ? 'groups' : `groups_${groupProfileType}`;
    const membersCollection = groupProfileType === 'basic' ? 'group_members' : `group_members_${groupProfileType}`;
    const invitationsCollection = groupProfileType === 'basic' ? 'group_invitations' : `group_invitations_${groupProfileType}`;

    const resolvedParams = await params;
    const group_id = resolvedParams.id;
    const inviter_id = session.user_id;

    console.log('Group invitation attempt:', { group_id, inviter_id, invited_user_id, profile_type: groupProfileType });

    // Check if group exists
    const group = await db.collection(groupsCollection).findOne({ group_id });
    if (!group) {
      console.log('Group not found:', group_id);
      return NextResponse.json({ success: false, message: 'Group not found' }, { status: 404 });
    }

    // Check if inviter is a member of the group
    const inviterMembership = await db.collection(membersCollection).findOne({ 
      group_id, 
      user_id: inviter_id 
    });
    console.log('Inviter membership:', inviterMembership);
    if (!inviterMembership) {
      return NextResponse.json({ success: false, message: 'You must be a member to invite others' }, { status: 403 });
    }

    // Check if user has permission to invite (could be expanded to check specific roles)
    // For now, any member can invite
    const canInvite = inviterMembership.role === 'owner' || 
                     inviterMembership.role === 'admin' || 
                     inviterMembership.role === 'member';
    
    if (!canInvite) {
      return NextResponse.json({ success: false, message: 'You do not have permission to invite users to this group' }, { status: 403 });
    }

    // Get inviter's username and display name
    const inviterUser = await db.collection('users').findOne({ user_id: inviter_id });
    if (!inviterUser) {
      return NextResponse.json({ success: false, message: 'Inviter not found' }, { status: 404 });
    }

    // Get inviter's profile-specific display name
    const profileCollectionName = `${groupProfileType}profiles`;
    const inviterProfile = await db.collection(profileCollectionName).findOne({ user_id: inviter_id });

    // Check if invited user exists
    const invitedUser = await db.collection('users').findOne({ user_id: invited_user_id });
    if (!invitedUser) {
      return NextResponse.json({ success: false, message: 'Invited user not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await db.collection(membersCollection).findOne({ 
      group_id, 
      user_id: invited_user_id 
    });
    if (existingMembership) {
      return NextResponse.json({ success: false, message: 'User is already a member' }, { status: 400 });
    }

    // Check if invitation already exists (any status)
    const existingInvitation = await db.collection(invitationsCollection).findOne({ 
      group_id, 
      invited_user_id
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
      inviter_username: inviterUser.username,
      inviter_display_name: inviterProfile?.display_name || inviterUser.username,
      invited_user_id,
      invited_username: invitedUser.username,
      created_at: new Date().toISOString(),
      status: 'pending',
      profile_type: groupProfileType
    };

    await db.collection(invitationsCollection).insertOne(invitation);

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      invitation_id: invitation.invitation_id
    });

  } catch (error: unknown) {
    // Handle duplicate key errors gracefully
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ success: false, message: 'Invitation already sent' }, { status: 400 });
    }
    console.error('Error sending group invitation:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
