import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../mongo-uri';
import { cookies } from 'next/headers';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

const client = new MongoClient(MONGODB_URI);

// GET: Get available questionnaires for a specific profile type
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
    const profileType = url.searchParams.get('profile_type');
    
    if (!profileType || !['basic', 'business', 'love'].includes(profileType)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Valid profile_type parameter is required (basic, business, or love)' 
      }, { status: 400 });
    }

    // Get questionnaire groups for the specified profile type
    const questionnaireGroups = await db.collection('questionnaire_groups').aggregate([
      { 
        $match: { 
          profile_type: profileType,
          is_hidden: false
        }
      },
      {
        $lookup: {
          from: 'questionnaires',
          localField: 'group_id',
          foreignField: 'group_id',
          as: 'questionnaires'
        }
      },
      {
        $match: {
          'questionnaires.0': { $exists: true } // Only groups with questionnaires
        }
      },
      {
        $project: {
          group_id: 1,
          title: 1,
          description: 1,
          profile_type: 1,
          questionnaires: {
            $filter: {
              input: '$questionnaires',
              cond: { $eq: ['$$this.is_hidden', false] }
            }
          }
        }
      },
      { $sort: { creation_date: 1 } }
    ]).toArray();

    // Get user's completed questionnaires
    const completedQuestionnaires = await db.collection('user_questionnaire_answers').aggregate([
      { $match: { user_id: session.user_id } },
      { $group: { _id: '$questionnaire_id' } }
    ]).toArray();

    const completedIds = new Set(completedQuestionnaires.map(item => item._id));

    // Mark completed questionnaires
    questionnaireGroups.forEach(group => {
      group.questionnaires.forEach((questionnaire: { questionnaire_id: string; completed?: boolean }) => {
        questionnaire.completed = completedIds.has(questionnaire.questionnaire_id);
      });
    });

    return NextResponse.json({ 
      success: true, 
      questionnaireGroups 
    });

  } catch (error) {
    console.error('Error fetching questionnaires:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
