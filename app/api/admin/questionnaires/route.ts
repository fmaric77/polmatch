import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

const client = new MongoClient(MONGODB_URI);

// GET: List all questionnaire groups (admin only)
export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session and admin status
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user || !user.is_admin) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    // Get all questionnaire groups with their questionnaires
    const questionnaireGroups = await db.collection('questionnaire_groups').aggregate([
      {
        $lookup: {
          from: 'questionnaires',
          localField: 'group_id',
          foreignField: 'group_id',
          as: 'questionnaires'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'created_by',
          foreignField: 'user_id',
          as: 'creator'
        }
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          group_id: 1,
          title: 1,
          description: 1,
          profile_type: 1,
          is_hidden: 1,
          required_for: 1,
          creation_date: 1,
          creator_username: '$creator.username',
          questionnaire_count: { $size: '$questionnaires' }
        }
      },
      { $sort: { creation_date: -1 } }
    ]).toArray();

    return NextResponse.json({ 
      success: true, 
      questionnaireGroups 
    });

  } catch (error) {
    console.error('Error fetching questionnaire groups:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}

// POST: Create new questionnaire group (admin only)
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session and admin status
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user || !user.is_admin) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    const { title, description, profile_type, is_hidden, required_for } = await request.json();

    if (!title || !description || !profile_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'Title, description, and profile_type are required' 
      }, { status: 400 });
    }

    if (!['basic', 'business', 'love'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'profile_type must be one of: basic, business, love' 
      }, { status: 400 });
    }

    // Create questionnaire group
    const groupId = uuidv4();
    const questionnaireGroup = {
      group_id: groupId,
      title,
      description,
      profile_type,
      is_hidden: is_hidden || false,
      required_for: required_for || [],
      created_by: session.user_id,
      creation_date: new Date()
    };

    await db.collection('questionnaire_groups').insertOne(questionnaireGroup);

    return NextResponse.json({ 
      success: true, 
      group_id: groupId,
      message: 'Questionnaire group created successfully' 
    });

  } catch (error) {
    console.error('Error creating questionnaire group:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
