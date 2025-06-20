import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../lib/mongodb-connection';

interface CatalogueItemDocument {
  catalogued_user_id: string;
  profile_type: string;
  added_at: string;
  owner_user_id: string;
}

interface UserDocument {
  user_id: string;
  username: string;
  display_name?: string;
}

interface EnrichedCatalogueItem {
  user_id: string;
  username: string;
  display_name: string;
  category: string;
  added_at: string;
  ai_excluded?: boolean;
}

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    
    // Get user session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // Fetch user's catalogue items
    const catalogueItemsRaw = await db.collection('user_catalogues')
      .find({ owner_user_id: session.user_id })
      .sort({ added_at: -1 })
      .toArray();
    const catalogueItems = catalogueItemsRaw as unknown as CatalogueItemDocument[];

    // Get user details for each catalogued user
    const userIds = catalogueItems.map((item: CatalogueItemDocument) => item.catalogued_user_id);
    const usersRaw = await db.collection('users')
      .find({ user_id: { $in: userIds } })
      .project({ user_id: 1, username: 1 })
      .toArray();
    const users = usersRaw as unknown as Array<{ user_id: string; username: string }>;

    // Get profile-specific display names for each user
    const profilePromises = catalogueItems.map(async (item: CatalogueItemDocument) => {
      const profileCollectionName = `${item.profile_type}profiles`; // Use 'basicprofiles', 'loveprofiles', 'businessprofiles'
      const profile = await db.collection(profileCollectionName)
        .findOne({ user_id: item.catalogued_user_id }, { projection: { display_name: 1, ai_excluded: 1 } });
      return { 
        user_id: item.catalogued_user_id, 
        profile_type: item.profile_type,
        profile_display_name: profile?.display_name || null,
        ai_excluded: profile?.ai_excluded || false
      };
    });
    
    const profileData = await Promise.all(profilePromises);

    // Combine catalogue data with user details and profile-specific display names
    const enrichedItems = catalogueItems.map((item: CatalogueItemDocument) => {
      const user = users.find((u: UserDocument) => u.user_id === item.catalogued_user_id);
      const profileInfo = profileData.find(p => p.user_id === item.catalogued_user_id && p.profile_type === item.profile_type);
      return {
        user_id: item.catalogued_user_id,
        username: user?.username || '',
        display_name: profileInfo?.profile_display_name || null, // Use profile-specific display name
        category: item.profile_type,
        added_at: item.added_at,
        ai_excluded: profileInfo?.ai_excluded || false
      };
    }).filter((item: EnrichedCatalogueItem) => item.username); // Filter out items where user no longer exists

    return NextResponse.json({
      success: true,
      items: enrichedItems
    });

  } catch (error) {
    console.error('Error fetching catalogue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch catalogue' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { user_id, category } = body;

    if (!user_id || !category) {
      return NextResponse.json(
        { success: false, error: 'user_id and category are required' },
        { status: 400 }
      );
    }

    if (!['love', 'basic', 'business'].includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category. Must be love, basic, or business' },
        { status: 400 }
      );
    }

    // Get user session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // Check if user is trying to add themselves
    if (session.user_id === user_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot add yourself to catalogue' },
        { status: 400 }
      );
    }

    // Check if user exists
    const targetUser = await db.collection('users').findOne({ user_id });
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if this specific user+category combination already exists
    const existingEntry = await db.collection('user_catalogues').findOne({
      owner_user_id: session.user_id,
      catalogued_user_id: user_id,
      profile_type: category
    });

    if (existingEntry) {
      // Entry already exists for this specific category
      return NextResponse.json({
        success: true,
        message: `User already in ${category} catalogue`
      });
    } else {
      // Add new entry (allows multiple categories for same user)
      await db.collection('user_catalogues').insertOne({
        owner_user_id: session.user_id,
        catalogued_user_id: user_id,
        profile_type: category,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: `User added to ${category} catalogue`
      });
    }

  } catch (error) {
    console.error('Error adding to catalogue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add to catalogue' },
      { status: 500 }
    );
  }
}
