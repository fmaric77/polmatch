import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

type ProfileType = 'basic' | 'love' | 'business';

interface MessageExpirySettings {
  user_id: string;
  profile_type: ProfileType;
  expiry_enabled: boolean;
  expiry_days: number;
  created_at: string;
  updated_at: string;
}

// GET: Fetch message expiry settings for all profiles
export async function GET(): Promise<NextResponse> {
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

    const userId = session.user_id;

    // Get expiry settings for all profile types with proper typing
    const settings = await db.collection('message_expiry_settings')
      .find({ user_id: userId })
      .toArray() as unknown as MessageExpirySettings[];
    
    // Create default settings for missing profile types
    const profileTypes: ProfileType[] = ['basic', 'love', 'business'];
    const settingsMap: Record<ProfileType, MessageExpirySettings> = {} as Record<ProfileType, MessageExpirySettings>;
    
    for (const profileType of profileTypes) {
      const existingSetting = settings.find(s => s.profile_type === profileType);
      
      if (existingSetting) {
        settingsMap[profileType] = existingSetting;
      } else {
        // Default settings: disabled
        settingsMap[profileType] = {
          user_id: userId,
          profile_type: profileType,
          expiry_enabled: false,
          expiry_days: 30, // Default to 30 days
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }

    return NextResponse.json({ 
      success: true, 
      settings: settingsMap 
    });

  } catch (error) {
    console.error('Error fetching message expiry settings:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch expiry settings' 
    }, { status: 500 });
  }
}

// POST: Update message expiry settings for a specific profile
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const { profile_type, expiry_enabled, expiry_days } = body as {
      profile_type: ProfileType;
      expiry_enabled: boolean;
      expiry_days: number;
    };

    // Validation
    if (!profile_type || !['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    if (typeof expiry_enabled !== 'boolean') {
      return NextResponse.json({ 
        success: false, 
        message: 'expiry_enabled must be a boolean' 
      }, { status: 400 });
    }

    if (expiry_enabled && (typeof expiry_days !== 'number' || expiry_days < 1 || expiry_days > 365)) {
      return NextResponse.json({ 
        success: false, 
        message: 'expiry_days must be a number between 1 and 365' 
      }, { status: 400 });
    }

    const userId = session.user_id;
    const now = new Date().toISOString();

    // Update or create the expiry setting
    const updateData: Partial<MessageExpirySettings> = {
      expiry_enabled,
      expiry_days: expiry_enabled ? expiry_days : 30, // Default days when disabled
      updated_at: now
    };

    const result = await db.collection('message_expiry_settings').updateOne(
      { user_id: userId, profile_type },
      { 
        $set: updateData,
        $setOnInsert: {
          user_id: userId,
          profile_type,
          created_at: now
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: `Message expiry settings updated for ${profile_type} profile`,
      upserted: !!result.upsertedId
    });

  } catch (error) {
    console.error('Error updating message expiry settings:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to update expiry settings' 
    }, { status: 500 });
  }
}