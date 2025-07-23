import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

// GET: Fetch available questionnaire filters for search users page
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
    
    if (!profileType || !['basic', 'love', 'business'].includes(profileType)) {
      return NextResponse.json({ 
        success: false, 
        options: { $exists: true, $ne: [] },
      }, { status: 400 });
    }

    // Get all multiple choice questions for the specified profile type
    const filters = await db.collection('questions').aggregate([
      {
        $match: {
          question_type: { $in: ['select', 'radio', 'checkbox'] },
          options: { $exists: true, $ne: [] }
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
        $project: {
          question_id: 1,
          question_text: 1,
          question_type: 1,
          options: 1,
          profile_display_text: 1,
          questionnaire_title: '$questionnaire.title',
          group_title: '$group.title'
        }
      },
      {
        $sort: { questionnaire_title: 1, display_order: 1 }
      }
    ]).toArray();

    return NextResponse.json({ 
      success: true, 
      filters,
      profile_type: profileType
    });

  } catch (error) {
    console.error('Error fetching questionnaire filters:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch filters' 
    }, { status: 500 });
  }
} 