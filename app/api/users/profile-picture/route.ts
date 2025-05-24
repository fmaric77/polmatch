import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

// GET: Fetch profile picture URL for a specific user
export async function GET(request: Request) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    if (!userId) return NextResponse.json({ success: false, message: 'Missing user_id' }, { status: 400 });
    
    // Get user's profile picture from their profile data
    const user = await db.collection('users').findOne({ user_id: userId });
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    
    // Check all profile types for profile picture URL
    let profilePictureUrl = null;
    
    // Check basic profile collection
    const basicProfile = await db.collection('basicprofiles').findOne({ user_id: userId });
    if (basicProfile?.profile_picture_url) {
      profilePictureUrl = basicProfile.profile_picture_url;
    }
    
    // Check love profile collection if no basic profile picture
    if (!profilePictureUrl) {
      const loveProfile = await db.collection('loveprofiles').findOne({ user_id: userId });
      if (loveProfile?.profile_picture_url) {
        profilePictureUrl = loveProfile.profile_picture_url;
      }
    }
    
    // Check business profile collection if no other profile pictures
    if (!profilePictureUrl) {
      const businessProfile = await db.collection('businessprofiles').findOne({ user_id: userId });
      if (businessProfile?.profile_picture_url) {
        profilePictureUrl = businessProfile.profile_picture_url;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      profile_picture_url: profilePictureUrl,
      user_id: userId 
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}
