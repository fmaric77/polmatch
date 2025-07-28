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

    // Get user's completed questionnaires - properly check if ALL questions are answered
    const userAnswers = await db.collection('user_questionnaire_answers').find({
      user_id: session.user_id
    }).toArray();

    // Group answers by questionnaire_id and count them
    const answerCounts = new Map();
    userAnswers.forEach(answer => {
      if (answer.answer && answer.answer.trim() !== '') {
        const count = answerCounts.get(answer.questionnaire_id) || 0;
        answerCounts.set(answer.questionnaire_id, count + 1);
      }
    });

    // Get question counts for each questionnaire
    const allQuestionnaires = questionnaireGroups.flatMap(group => group.questionnaires);
    const questionnaireIds = allQuestionnaires.map(q => q.questionnaire_id);
    
    const questionCounts = await db.collection('questions').aggregate([
      { $match: { questionnaire_id: { $in: questionnaireIds } } },
      { $group: { _id: '$questionnaire_id', count: { $sum: 1 } } }
    ]).toArray();

    const questionCountMap = new Map();
    questionCounts.forEach(item => {
      questionCountMap.set(item._id, item.count);
    });

    // Mark completed questionnaires - only if all questions are answered
    questionnaireGroups.forEach(group => {
      group.questionnaires.forEach((questionnaire: { questionnaire_id: string; completed?: boolean }) => {
        const answeredCount = answerCounts.get(questionnaire.questionnaire_id) || 0;
        const totalQuestions = questionCountMap.get(questionnaire.questionnaire_id) || 0;
        questionnaire.completed = answeredCount === totalQuestions && totalQuestions > 0;
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
