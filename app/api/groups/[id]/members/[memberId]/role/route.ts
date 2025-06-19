import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../../mongo-uri';
import { cookies } from 'next/headers';


if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Verify session
    const session = await db.collection('sessions').findOne({ 
      sessionToken: sessionToken 
    });
    
    if (!session) {
      await client.close();
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const params = await context.params;
    const groupId = params.id;
    const memberId = params.memberId;
    const { role } = await req.json();

    if (!role) {
      await client.close();
      return NextResponse.json({ 
        error: 'Role is required' 
      }, { status: 400 });
    }

    if (!['admin', 'member'].includes(role)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Role must be either admin or member' 
      }, { status: 400 });
    }

    // Check if group exists
    const group = await db.collection('groups').findOne({ group_id: groupId });
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if requester is admin/owner
    const requesterMembership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    const isAdmin = group.creator_id === session.user_id || 
                   (requesterMembership && (requesterMembership.role === 'owner' || requesterMembership.role === 'admin'));

    if (!isAdmin) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only group admins can change member roles' 
      }, { status: 403 });
    }

    // Check if target user is a member
    const targetMembership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: memberId
    });

    if (!targetMembership) {
      await client.close();
      return NextResponse.json({ 
        error: 'User is not a member of this group' 
      }, { status: 400 });
    }

    // Prevent changing the role of the group creator
    if (group.creator_id === memberId) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot change the role of the group creator' 
      }, { status: 400 });
    }

    // Prevent non-owners from promoting members to admin if the target is already an admin
    if (role === 'admin' && targetMembership.role === 'admin') {
      await client.close();
      return NextResponse.json({ 
        error: 'User is already an admin' 
      }, { status: 400 });
    }

    // Prevent non-owners from demoting other admins (only owners can demote admins)
    if (targetMembership.role === 'admin' && role === 'member') {
      if (group.creator_id !== session.user_id) {
        await client.close();
        return NextResponse.json({ 
          error: 'Only the group creator can demote administrators' 
        }, { status: 403 });
      }
    }

    // Update user role
    await db.collection('group_members').updateOne(
      {
        group_id: groupId,
        user_id: memberId
      },
      {
        $set: { 
          role: role,
          role_updated_at: new Date(),
          role_updated_by: session.user_id
        }
      }
    );

    // Update group last activity
    await db.collection('groups').updateOne(
      { group_id: groupId },
      { $set: { last_activity: new Date() } }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: `Member ${role === 'admin' ? 'promoted to' : 'demoted to'} ${role} successfully` 
    });

  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
