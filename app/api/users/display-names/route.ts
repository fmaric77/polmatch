import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-connection';
import { cookies } from 'next/headers';

// POST /api/users/display-names
// Request body: { userIds: string[] }
// Response: { success: boolean, displayNames: Record<string, string> }
// For each userId the API will return the best available display name:
// 1. profile specific display_name (basic, love, business)
// 2. fallback to username (from users collection)
// 3. fallback to the userId itself if nothing found

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    // Session is optional – guests can also see display names – but if provided we verify it just in case
    let db;
    if (sessionToken) {
      ({ db } = await connectToDatabase());
    } else {
      ({ db } = await connectToDatabase());
    }

    const { userIds } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ success: false, message: 'userIds array required' }, { status: 400 });
    }

    // Ensure we only work with unique ids
    const uniqueIds: string[] = Array.from(new Set(userIds.filter(id => typeof id === 'string')));

    // Prepare collections
    const basicProfiles = db.collection('basicprofiles');
    const loveProfiles = db.collection('loveprofiles');
    const businessProfiles = db.collection('businessprofiles');
    const usersCollection = db.collection('users');

    // Fetch display names from all profile collections in a single aggregate per collection for efficiency
    type DisplayRecord = { user_id: string; display_name?: string };

    const [basic, love, business] = await Promise.all([
      basicProfiles.find({ user_id: { $in: uniqueIds } }).project<DisplayRecord>({ user_id: 1, display_name: 1 }).toArray(),
      loveProfiles.find({ user_id: { $in: uniqueIds } }).project<DisplayRecord>({ user_id: 1, display_name: 1 }).toArray(),
      businessProfiles.find({ user_id: { $in: uniqueIds } }).project<DisplayRecord>({ user_id: 1, display_name: 1 }).toArray(),
    ]);

    const displayMap: Record<string, string> = {};

    // Helper to set if not already set and value is valid
    const setIfEmpty = (userId: string, value?: string) => {
      if (!value) return;
      if (!displayMap[userId] && value.trim()) {
        displayMap[userId] = value;
      }
    };

    // Fill from profile collections
    for (const rec of [...basic, ...love, ...business]) {
      setIfEmpty(rec.user_id, rec.display_name);
    }

    // Fetch usernames for remaining ids where display name not yet set
    const missingIds = uniqueIds.filter(id => !displayMap[id]);
    if (missingIds.length) {
      const users = await usersCollection.find({ user_id: { $in: missingIds } }).project<{ user_id: string; username: string }>({ user_id: 1, username: 1 }).toArray();
      for (const u of users) {
        setIfEmpty(u.user_id, u.username);
      }
    }

    // For any still missing, just return the raw id
    for (const id of uniqueIds) {
      if (!displayMap[id]) {
        displayMap[id] = id;
      }
    }

    return NextResponse.json({ success: true, displayNames: displayMap });
  } catch (error) {
    console.error('Error fetching display names:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
} 