import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';

const client = new MongoClient(MONGODB_URI);

// GET: Fetch all profiles and questionnaire answers for a specific user
export async function GET(request: NextRequest) {
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Get user session for authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Get target user ID from query parameters
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('user_id');
    
    if (!targetUserId) {
      return NextResponse.json({ success: false, message: 'user_id parameter is required' }, { status: 400 });
    }
    
    // Verify target user exists
    const targetUser = await db.collection('users').findOne({ user_id: targetUserId });
    if (!targetUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    // Fetch all profile types for the target user
    const basicProfile = await db.collection('basicprofiles').findOne({ user_id: targetUserId });
    const loveProfile = await db.collection('loveprofiles').findOne({ user_id: targetUserId });
    const businessProfile = await db.collection('busprofiles').findOne({ user_id: targetUserId });
    
    // Check visibility settings - only return public profiles or profiles where user is friends
    const friendshipCheck = await db.collection('friends').findOne({
      $or: [
        { user_id: session.user_id, friend_id: targetUserId, status: 'accepted' },
        { user_id: targetUserId, friend_id: session.user_id, status: 'accepted' }
      ]
    });
    
    const isFriends = !!friendshipCheck;
    
    // Filter profiles based on visibility
    const profiles = {
      basic: (basicProfile && (basicProfile.visibility === 'public' || isFriends)) ? basicProfile : null,
      love: (loveProfile && (loveProfile.visibility === 'public' || isFriends)) ? loveProfile : null,
      business: (businessProfile && (businessProfile.visibility === 'public' || isFriends)) ? businessProfile : null
    };
    
    // Fetch questionnaire answers for public/visible profiles
    const questionnaireAnswers: Record<string, unknown[]> = {};
    
    for (const [profileType, profile] of Object.entries(profiles)) {
      if (profile) {
        // Get questionnaire answers for this profile type
        const answers = await db.collection('user_questionnaire_answers').aggregate([
          {
            $match: { user_id: targetUserId }
          },
          {
            $lookup: {
              from: 'questionnaires',
              localField: 'questionnaire_id',
              foreignField: 'questionnaire_id',
              as: 'questionnaire'
            }
          },
          {
            $unwind: '$questionnaire'
          },
          {
            $lookup: {
              from: 'questionnaire_groups',
              localField: 'questionnaire.group_id',
              foreignField: 'group_id',
              as: 'group'
            }
          },
          {
            $unwind: '$group'
          },
          {
            $match: {
              'group.profile_type': profileType,
              'group.is_hidden': false,
              'questionnaire.is_hidden': false
            }
          },
          {
            $lookup: {
              from: 'questions',
              localField: 'question_id',
              foreignField: 'question_id',
              as: 'question'
            }
          },
          {
            $unwind: '$question'
          },
          {
            $group: {
              _id: '$questionnaire_id',
              questionnaire_title: { $first: '$questionnaire.title' },
              questionnaire_description: { $first: '$questionnaire.description' },
              group_title: { $first: '$group.title' },
              answers: {
                $push: {
                  question_id: '$question_id',
                  question_text: '$question.question_text',
                  answer: '$answer',
                  completion_date: '$completion_date'
                }
              }
            }
          },
          {
            $sort: { questionnaire_title: 1 }
          }
        ]).toArray();
        
        questionnaireAnswers[profileType] = answers;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        user_id: targetUserId,
        username: targetUser.username
      },
      profiles,
      questionnaire_answers: questionnaireAnswers,
      is_friends: isFriends
    });
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
