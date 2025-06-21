import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

// Helper function to determine if a profile should be visible based on visibility settings
function getVisibleProfile(profile: unknown, isFriends: boolean, isOwnProfile: boolean): unknown {
  if (!profile) return null;
  
  const profileObj = profile as { visibility?: string };
  const visibility = profileObj.visibility || 'public';
  
  // Own profile is always visible
  if (isOwnProfile) return profile;
  
  // Handle visibility levels
  switch (visibility) {
    case 'public':
      return profile;
    case 'friends':
      return isFriends ? profile : null;
    case 'private':
      return null;
    default:
      return profile; // Default to public for backward compatibility
  }
}

// GET: Fetch all profiles and questionnaire answers for a specific user
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
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
    const businessProfile = await db.collection('businessprofiles').findOne({ user_id: targetUserId });
    
    // Check visibility settings - only return public profiles or profiles where user is friends
    const friendshipCheck = await db.collection('friends').findOne({
      $or: [
        { user_id: session.user_id, friend_id: targetUserId, status: 'accepted' },
        { user_id: targetUserId, friend_id: session.user_id, status: 'accepted' }
      ]
    });
    
    const isFriends = !!friendshipCheck;
    
    // Profile types and their profile data
    const profileMap: Record<string, unknown> = {
      basic: basicProfile,
      love: loveProfile,
      business: businessProfile
    };

    const profiles: Record<string, unknown> = {};
    const questionnaireAnswers: Record<string, unknown[]> = {};

    for (const profileType of Object.keys(profileMap)) {
      const profileData = profileMap[profileType];
      if (!profileData) {
        profiles[profileType] = null;
        continue;
      }

      // Check friendship status in profile-specific and general collections
      const friendsCollectionName = `friends_${profileType}`;
      const friendshipDoc = await db.collection(friendsCollectionName).findOne({
        $or: [
          { user_id: session.user_id, friend_id: targetUserId, status: 'accepted' },
          { user_id: targetUserId, friend_id: session.user_id, status: 'accepted' }
        ]
      });
      // Combine general and profile-specific friendship checks
      const isProfileFriends = !!friendshipDoc || isFriends;
      const isOwnProfile = session.user_id === targetUserId;

      // Determine profile visibility per-profile
      const visibleProfile = getVisibleProfile(profileData, isProfileFriends, isOwnProfile);
      profiles[profileType] = visibleProfile;

      if (!visibleProfile) {
        questionnaireAnswers[profileType] = [];
        continue;
      }

      // Fetch and filter questionnaire answers
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
                completion_date: '$completion_date',
                profile_display_text: '$question.profile_display_text',
                visibility: { $ifNull: ['$visibility', 'public'] } // Default to 'public' for backward compatibility
              }
            }
          }
        },
        {
          $sort: { questionnaire_title: 1 }
        }
      ]).toArray();

      const filteredAnswers = answers.map(q => ({
        ...q,
        answers: q.answers.filter((ans: { visibility: string }) => {
          const v = ans.visibility || 'public';
          if (isOwnProfile) return true;
          switch (v) {
            case 'public': return true;
            case 'friends': return isProfileFriends;
            case 'private': return false;
            default: return true;
          }
        })
      })).filter(q => q.answers.length > 0);

      questionnaireAnswers[profileType] = filteredAnswers;
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
  }
}
