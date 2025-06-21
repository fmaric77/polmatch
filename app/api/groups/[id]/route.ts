import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';
import { 
  validateGroupId, 
  createValidationErrorResponse,
  checkRateLimit
} from '../../../../lib/validation';
import { validateSession } from '../../../../lib/auth';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`delete_group_${clientIP}`, 5, 60000)) {
      return createValidationErrorResponse('Too many delete requests. Please try again later.', 429);
    }

    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return createValidationErrorResponse('Unauthorized', 401);
    }

    // Validate session using new utility
    const sessionResult = await validateSession(sessionToken);
    if (!sessionResult.valid || !sessionResult.session) {
      return createValidationErrorResponse('Invalid or expired session', 401);
    }
    const session = sessionResult.session;

    // Validate group ID
    const { id } = await params;
    const groupIdValidation = validateGroupId(id);
    if (!groupIdValidation.isValid) {
      return createValidationErrorResponse(groupIdValidation.error!, 400);
    }
    const group_id = id;

    // Get profile_type from query parameters  
    const url = new URL(req.url);
    const profile_type = url.searchParams.get('profile_type') || 'basic';

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return createValidationErrorResponse('Invalid profile_type. Must be basic, love, or business', 400);
    }

    // Use profile-specific collections
    const groupsCollection = profile_type === 'basic' ? 'groups' : `groups_${profile_type}`;
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const messagesCollection = profile_type === 'basic' ? 'group_messages' : `group_messages_${profile_type}`;
    const invitationsCollection = profile_type === 'basic' ? 'group_invitations' : `group_invitations_${profile_type}`;

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Check if group exists and user is the creator
    const group = await db.collection(groupsCollection).findOne({ group_id });
    
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if user is creator (either by creator_id or by having owner/admin role)
    const membership = await db.collection(membersCollection).findOne({
      group_id,
      user_id: session.user_id
    });

    const isCreator = group.creator_id === session.user_id || 
                     (membership && (membership.role === 'owner' || membership.role === 'admin'));

    if (!isCreator) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only the group creator can delete the group' 
      }, { status: 403 });
    }

    // Delete group and all related data
    await Promise.all([
      // Delete the group
      db.collection(groupsCollection).deleteOne({ group_id }),
      // Delete all group members
      db.collection(membersCollection).deleteMany({ group_id }),
      // Delete all group messages
      db.collection(messagesCollection).deleteMany({ group_id }),
      // Delete all group invitations
      db.collection(invitationsCollection).deleteMany({ group_id })
    ]);

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Group successfully deleted' 
    });

  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
