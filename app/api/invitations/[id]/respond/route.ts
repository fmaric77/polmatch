import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-connection';
import { cookies } from 'next/headers';

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

    const body = await request.json();
    const { action, profile_type = 'basic' } = body; // 'accept' or 'decline'
    
    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid action. Use "accept" or "decline"' }, { status: 400 });
    }

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ success: false, message: 'Invalid profile type' }, { status: 400 });
    }

    const resolvedParams = await params;
    const invitation_id = resolvedParams.id;

    // Use profile-specific collections
    const invitationsCollection = `group_invitations_${profile_type}`;
    const groupsCollection = `groups_${profile_type}`;
    const membersCollection = `group_members_${profile_type}`;
    const bansCollection = `group_bans_${profile_type}`;

    // Find the invitation
    const invitation = await db.collection(invitationsCollection).findOne({ 
      invitation_id,
      invited_user_id: session.user_id,
      status: 'pending'
    });

    if (!invitation) {
      return NextResponse.json({ success: false, message: 'Invitation not found or already responded' }, { status: 404 });
    }

    // Remove the invitation so it no longer blocks re-invitation
    await db.collection(invitationsCollection).deleteOne({ invitation_id });

    // If accepted, add user to group
    if (action === 'accept') {
      // Check if group still exists
      const group = await db.collection(groupsCollection).findOne({ group_id: invitation.group_id });
      if (!group) {
        return NextResponse.json({ success: false, message: 'Group no longer exists' }, { status: 404 });
      }

      // Check if user is already a member (edge case)
      const existingMembership = await db.collection(membersCollection).findOne({ 
        group_id: invitation.group_id, 
        user_id: session.user_id 
      });

      // Check if user is banned from this group
      const banRecord = await db.collection(bansCollection).findOne({
        group_id: invitation.group_id,
        user_id: session.user_id
      });

      if (banRecord) {
        return NextResponse.json({ 
          success: false, 
          message: 'You are banned from this group and cannot accept invitations' 
        }, { status: 403 });
      }

      if (!existingMembership) {
        // Add user to group
        await db.collection(membersCollection).insertOne({
          group_id: invitation.group_id,
          user_id: session.user_id,
          join_date: new Date().toISOString(),
          role: 'member'
        });

        // Update group member count
        await db.collection(groupsCollection).updateOne(
          { group_id: invitation.group_id },
          { 
            $inc: { members_count: 1 },
            $set: { last_activity: new Date().toISOString() }
          }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: action === 'accept' ? 'Invitation accepted! You have joined the group.' : 'Invitation declined.',
      action
    });

  } catch (error) {
    console.error('Error responding to invitation:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
