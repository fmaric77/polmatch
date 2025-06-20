import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

interface QuestionnaireFilter {
  question_id: string;
  selected_answers: string[];
}

// GET: Search users with questionnaire filters
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const url = new URL(request.url);
    const profileType = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business';
    const searchQuery = url.searchParams.get('search') || '';
    const filtersParam = url.searchParams.get('filters');
    const sortBy = url.searchParams.get('sort_by'); // 'similarity' or null
    
    if (!profileType || !['basic', 'love', 'business'].includes(profileType)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Valid profile_type parameter is required (basic, love, or business)' 
      }, { status: 400 });
    }

    let questionnaireFilters: QuestionnaireFilter[] = [];
    if (filtersParam) {
      try {
        questionnaireFilters = JSON.parse(filtersParam);
      } catch {
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid filters parameter' 
        }, { status: 400 });
      }
    }

    const currentUserId = session.user_id;
    const profileCollectionName = `${profileType}profiles`;

    // Get current user's answers for similarity calculation if needed
    let currentUserAnswers: Record<string, string> = {};
    if (sortBy === 'similarity') {
      const userAnswersRaw = await db.collection('user_questionnaire_answers').aggregate([
        { $match: { user_id: currentUserId } },
        {
          $lookup: {
            from: 'questionnaires',
            localField: 'questionnaire_id',
            foreignField: 'questionnaire_id',
            as: 'questionnaire'
          }
        },
        { $unwind: '$questionnaire' },
        {
          $lookup: {
            from: 'questionnaire_groups',
            localField: 'questionnaire.group_id',
            foreignField: 'group_id',
            as: 'group'
          }
        },
        { $unwind: '$group' },
        {
          $match: {
            'group.profile_type': profileType,
            'group.is_hidden': false,
            'questionnaire.is_hidden': false
          }
        },
        {
          $project: {
            question_id: 1,
            answer: 1
          }
        }
      ]).toArray();
      
      currentUserAnswers = userAnswersRaw.reduce((acc: Record<string, string>, answer) => {
        const typedAnswer = answer as { question_id: string; answer: string };
        acc[typedAnswer.question_id] = typedAnswer.answer;
        return acc;
      }, {});
    }

    // Build aggregation pipeline
    const pipeline: Record<string, unknown>[] = [
      // Start with profiles of the specified type
      {
        $match: {
          user_id: { $ne: currentUserId } // Exclude current user
        }
      },
      // Get user information
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      }
    ];

    // Add questionnaire filters if provided
    if (questionnaireFilters.length > 0) {
      for (const filter of questionnaireFilters) {
        pipeline.push({
          $lookup: {
            from: 'user_questionnaire_answers',
            let: { userId: '$user_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$user_id', '$$userId'] },
                      { $eq: ['$question_id', filter.question_id] },
                      { $in: ['$answer', filter.selected_answers] }
                    ]
                  }
                }
              }
            ],
            as: `filter_${filter.question_id}`
          }
        });
        
        // Require that the filter matched
        pipeline.push({
          $match: {
            [`filter_${filter.question_id}.0`]: { $exists: true }
          }
        });
      }
    }

    // Add search query filter if provided
    if (searchQuery) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.username': { $regex: searchQuery, $options: 'i' } },
            { 'display_name': { $regex: searchQuery, $options: 'i' } }
          ]
        }
      });
    }

    // Project final results
    pipeline.push({
      $project: {
        user_id: '$user_id',
        username: '$user.username',
        display_name: '$display_name',
        profile_type: profileType
      }
    });

    // Add similarity scoring if requested
    if (sortBy === 'similarity' && Object.keys(currentUserAnswers).length > 0) {
      // Add lookup for each user's answers
      pipeline.push({
        $lookup: {
          from: 'user_questionnaire_answers',
          let: { userId: '$user_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$user_id', '$$userId'] }
              }
            },
            {
              $lookup: {
                from: 'questionnaires',
                localField: 'questionnaire_id',
                foreignField: 'questionnaire_id',
                as: 'questionnaire'
              }
            },
            { $unwind: '$questionnaire' },
            {
              $lookup: {
                from: 'questionnaire_groups',
                localField: 'questionnaire.group_id',
                foreignField: 'group_id',
                as: 'group'
              }
            },
            { $unwind: '$group' },
            {
              $match: {
                'group.profile_type': profileType,
                'group.is_hidden': false,
                'questionnaire.is_hidden': false
              }
            },
            {
              $project: {
                question_id: 1,
                answer: 1
              }
            }
          ],
          as: 'user_answers'
        }
      });

      // Calculate similarity score
      pipeline.push({
        $addFields: {
          similarity_score: {
            $divide: [
              {
                $size: {
                  $filter: {
                    input: '$user_answers',
                    cond: {
                      $in: [
                        { $concat: ['$$this.question_id', ':', '$$this.answer'] },
                        Object.entries(currentUserAnswers).map(([qId, answer]) => `${qId}:${answer}`)
                      ]
                    }
                  }
                }
              },
              { $max: [{ $size: '$user_answers' }, Object.keys(currentUserAnswers).length] }
            ]
          }
        }
      });

      // Sort by similarity score (descending)
      pipeline.push({
        $sort: { similarity_score: -1 }
      });

      // Clean up the projection
      pipeline.push({
        $project: {
          user_id: 1,
          username: 1,
          display_name: 1,
          profile_type: 1,
          similarity_score: 1
        }
      });
    }

    // Execute the aggregation
    const users = await db.collection(profileCollectionName).aggregate(pipeline).toArray();

    return NextResponse.json({ 
      success: true, 
      users,
      profile_type: profileType,
      total_count: users.length
    });

  } catch (error) {
    console.error('Error searching users with filters:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to search users' 
    }, { status: 500 });
  }
} 