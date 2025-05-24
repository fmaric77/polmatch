import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const client = new MongoClient(MONGODB_URI);

interface RouteContext {
  params: Promise<{ id: string }>;
}

type QuestionInput = {
  question_id?: string;
  question_text: string;
  question_type: string;
  options?: string[];
  is_required?: boolean;
  display_order?: number;
};

// GET: Get specific questionnaire group with questions (admin only)
export async function GET(req: NextRequest, context: RouteContext) {
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

    const params = await context.params;
    const groupId = params.id;

    // Get questionnaire group with all questionnaires and questions
    const questionnaireGroup = await db.collection('questionnaire_groups').aggregate([
      { $match: { group_id: groupId } },
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
          questionnaires: 1
        }
      }
    ]).toArray();

    if (!questionnaireGroup.length) {
      return NextResponse.json({ 
        success: false, 
        message: 'Questionnaire group not found' 
      }, { status: 404 });
    }

    // Get questions for each questionnaire
    const group = questionnaireGroup[0];
    for (const questionnaire of group.questionnaires) {
      const questions = await db.collection('questions')
        .find({ questionnaire_id: questionnaire.questionnaire_id })
        .sort({ display_order: 1 })
        .toArray();
      questionnaire.questions = questions;
    }

    return NextResponse.json({ 
      success: true, 
      questionnaireGroup: group 
    });

  } catch (error) {
    console.error('Error fetching questionnaire group:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}

// POST: Create questionnaire within a group (admin only)
export async function POST(req: NextRequest, context: RouteContext) {
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

    const params = await context.params;
    const groupId = params.id;

    // Verify group exists
    const group = await db.collection('questionnaire_groups').findOne({ group_id: groupId });
    if (!group) {
      return NextResponse.json({ 
        success: false, 
        message: 'Questionnaire group not found' 
      }, { status: 404 });
    }

    const { title, description, is_hidden, questions } = await req.json();

    if (!title || !description || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Title, description, and questions array are required' 
      }, { status: 400 });
    }

    // Create questionnaire
    const questionnaireId = uuidv4();
    const questionnaire = {
      questionnaire_id: questionnaireId,
      group_id: groupId,
      title,
      description,
      created_by: session.user_id,
      creation_date: new Date(),
      is_hidden: is_hidden || false
    };

    await db.collection('questionnaires').insertOne(questionnaire);

    // Create questions
    const questionsToInsert = questions.map((question: QuestionInput, index: number) => ({
      question_id: uuidv4(),
      questionnaire_id: questionnaireId,
      question_text: question.question_text,
      question_type: question.question_type || 'text',
      options: question.options || [],
      is_required: question.is_required || false,
      display_order: question.display_order || index + 1
    }));

    if (questionsToInsert.length > 0) {
      await db.collection('questions').insertMany(questionsToInsert);
    }

    return NextResponse.json({ 
      success: true, 
      questionnaire_id: questionnaireId,
      message: 'Questionnaire created successfully' 
    });

  } catch (error) {
    console.error('Error creating questionnaire:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}

// DELETE: Delete questionnaire group (admin only)
export async function DELETE(req: NextRequest, context: RouteContext) {
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

    const params = await context.params;
    const groupId = params.id;

    // Get all questionnaires in this group
    const questionnaires = await db.collection('questionnaires').find({ group_id: groupId }).toArray();
    const questionnaireIds = questionnaires.map(q => q.questionnaire_id);

    // Delete in order: questions, user answers, questionnaires, group
    if (questionnaireIds.length > 0) {
      await db.collection('questions').deleteMany({ questionnaire_id: { $in: questionnaireIds } });
      await db.collection('user_questionnaire_answers').deleteMany({ questionnaire_id: { $in: questionnaireIds } });
      await db.collection('required_questionnaires').deleteMany({ questionnaire_id: { $in: questionnaireIds } });
      await db.collection('profile_questionnaire_visibility').deleteMany({ questionnaire_id: { $in: questionnaireIds } });
      await db.collection('searchable_questionnaire_answers').deleteMany({ questionnaire_id: { $in: questionnaireIds } });
    }

    await db.collection('questionnaires').deleteMany({ group_id: groupId });
    await db.collection('questionnaire_groups').deleteOne({ group_id: groupId });

    return NextResponse.json({ 
      success: true, 
      message: 'Questionnaire group deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting questionnaire group:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
