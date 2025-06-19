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

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Check if group exists and user is the creator
    const group = await db.collection('groups').findOne({ group_id });
    
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if user is creator (either by creator_id or by having owner/admin role)
    const membership = await db.collection('group_members').findOne({
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
      db.collection('groups').deleteOne({ group_id }),
      // Delete all group members
      db.collection('group_members').deleteMany({ group_id }),
      // Delete all group messages
      db.collection('group_messages').deleteMany({ group_id }),
      // Delete all group invitations
      db.collection('group_invitations').deleteMany({ group_id })
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
