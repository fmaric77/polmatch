import { NextResponse, NextRequest } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

const client = new MongoClient(MONGODB_URI);

// Get list of users available for inviting (excluding current user and group members)
export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const groupId = url.searchParams.get('group_id');
    const profileType = url.searchParams.get('profile_type') || 'basic';

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profileType)) {
      return NextResponse.json({ success: false, message: 'Invalid profile type' }, { status: 400 });
    }

    let query: Record<string, unknown> = { user_id: { $ne: session.user_id } };

    // If group_id is provided, exclude users who are already members of that group
    if (groupId) {
      // Use profile-specific collection for group members
      const membersCollection = `group_members_${profileType}`;
      
      // Get existing group members
      const existingMembers = await db.collection(membersCollection)
        .find({ group_id: groupId }, { projection: { user_id: 1 } })
        .toArray();
      
      const memberUserIds = existingMembers.map(member => member.user_id);
      
      // Exclude current user and existing group members
      query = {
        user_id: { 
          $ne: session.user_id,
          $nin: memberUserIds 
        }
      };
    }

    // Get all users except the current user and existing group members (if group_id provided)
    const users = await db.collection('users')
      .find(query, { projection: { user_id: 1, username: 1 } })
      .toArray();

    // Fetch profile-specific display names for these users
    const userIds = users.map(user => user.user_id);
    const profileCollectionName = `${profileType}profiles`;
    const profiles = await db.collection(profileCollectionName)
      .find({ user_id: { $in: userIds } })
      .project({ user_id: 1, display_name: 1 })
      .toArray();

    // Create a map for quick lookup
    const profileMap = new Map(profiles.map(p => [p.user_id, p.display_name]));

    // Only include users who have valid profile-specific display names
    const enrichedUsers = users
      .filter(user => {
        const profileDisplayName = profileMap.get(user.user_id);
        return profileDisplayName && 
               profileDisplayName.trim() && 
               profileDisplayName !== '[NO PROFILE NAME]';
      })
      .map(user => ({
        user_id: user.user_id,
        username: user.username,
        display_name: profileMap.get(user.user_id)
      }));

    return NextResponse.json({ 
      success: true, 
      users: enrichedUsers 
    });

  } catch (error) {
    console.error('Error fetching available users:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
}
