import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';

const client = new MongoClient(MONGODB_URI);

// Respond to a group invitation (accept or decline)
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

    const { action } = await request.json(); // 'accept' or 'decline'
    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid action. Use "accept" or "decline"' }, { status: 400 });
    }

    const resolvedParams = await params;
    const invitation_id = resolvedParams.id;

    // Find the invitation
    const invitation = await db.collection('group_invitations').findOne({ 
      invitation_id,
      invited_user_id: session.user_id,
      status: 'pending'
    });

    if (!invitation) {
      return NextResponse.json({ success: false, message: 'Invitation not found or already responded' }, { status: 404 });
    }

    // Update invitation status
    await db.collection('group_invitations').updateOne(
      { invitation_id },
      { 
        $set: { 
          status: action === 'accept' ? 'accepted' : 'declined',
          responded_at: new Date().toISOString()
        }
      }
    );

    // If accepted, add user to group
    if (action === 'accept') {
      // Check if group still exists
      const group = await db.collection('groups').findOne({ group_id: invitation.group_id });
      if (!group) {
        return NextResponse.json({ success: false, message: 'Group no longer exists' }, { status: 404 });
      }

      // Check if user is already a member (edge case)
      const existingMembership = await db.collection('group_members').findOne({ 
        group_id: invitation.group_id, 
        user_id: session.user_id 
      });

      // Check if user is banned from this group
      const banRecord = await db.collection('group_bans').findOne({
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
        await db.collection('group_members').insertOne({
          group_id: invitation.group_id,
          user_id: session.user_id,
          join_date: new Date().toISOString(),
          role: 'member'
        });

        // Update group member count
        await db.collection('groups').updateOne(
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
  } finally {
    await client.close();
  }
}
