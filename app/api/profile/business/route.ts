import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { validateImageUrl } from '../../../../lib/image-validation';

const client = new MongoClient(process.env.MONGODB_URI!);

export async function GET() {
  try {
    await client.connect();
    const db = client.db('polmatch');
    // Get user session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user_id = session.user_id;
    // Find business profile
    const profile = await db.collection('businessprofiles').findOne({ user_id });
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  } finally {
    await client.close();
  }
}

export async function POST(request: Request) {
  try {
    await client.connect();
    const db = client.db('polmatch');
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user_id = session.user_id;
    const data = await request.json();
    
    // Validate image URL if provided
    if (data.profile_picture_url && data.profile_picture_url.trim()) {
      const imageValidation = validateImageUrl(data.profile_picture_url.trim());
      if (!imageValidation.isValid) {
        return NextResponse.json({ 
          success: false, 
          message: `Invalid image URL: ${imageValidation.error}` 
        }, { status: 400 });
      }
    }
    
    // Ensure required fields
    const profile = await db.collection('businessprofiles').findOne({ user_id });
    const profile_id = profile?.profile_id || data.profile_id || uuidv4();
    const doc = {
      profile_id,
      user_id,
      display_name: data.display_name || '',
      bio: data.bio || '',
      profile_picture_url: data.profile_picture_url ? data.profile_picture_url.trim() : '',
      visibility: data.visibility || 'public',
      ai_excluded: data.ai_excluded || false,
      last_updated: new Date().toISOString(),
      assigned_questionnaires: data.assigned_questionnaires || {},
      completed_questionnaires: data.completed_questionnaires || {},
    };
    await db.collection('businessprofiles').updateOne(
      { user_id },
      { $set: doc },
      { upsert: true }
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  } finally {
    await client.close();
  }
}
