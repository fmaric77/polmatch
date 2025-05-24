import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../../mongo-uri';
import { cookies } from 'next/headers';

const client = new MongoClient(MONGODB_URI);

interface RouteContext {
  params: Promise<{ id: string; questionnaireId: string }>;
}

// DELETE: Delete specific questionnaire (admin only)
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
    const { id: groupId, questionnaireId } = params;

    // Verify questionnaire exists and belongs to the group
    const questionnaire = await db.collection('questionnaires').findOne({ 
      questionnaire_id: questionnaireId,
      group_id: groupId 
    });

    if (!questionnaire) {
      return NextResponse.json({ 
        success: false, 
        message: 'Questionnaire not found' 
      }, { status: 404 });
    }

    // Delete related data
    await db.collection('questions').deleteMany({ questionnaire_id: questionnaireId });
    await db.collection('user_questionnaire_answers').deleteMany({ questionnaire_id: questionnaireId });
    await db.collection('required_questionnaires').deleteMany({ questionnaire_id: questionnaireId });
    await db.collection('profile_questionnaire_visibility').deleteMany({ questionnaire_id: questionnaireId });
    await db.collection('searchable_questionnaire_answers').deleteMany({ questionnaire_id: questionnaireId });
    
    // Delete questionnaire
    await db.collection('questionnaires').deleteOne({ questionnaire_id: questionnaireId });

    return NextResponse.json({ 
      success: true, 
      message: 'Questionnaire deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting questionnaire:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}

// PUT: Update specific questionnaire (admin only)
export async function PUT(req: NextRequest, context: RouteContext) {
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
    const { id: groupId, questionnaireId } = params;
    const body = await req.json();
    // Update questionnaire document
    await db.collection('questionnaires').updateOne(
      { questionnaire_id: questionnaireId, group_id: groupId },
      { $set: {
        title: body.title,
        description: body.description,
        is_hidden: body.is_hidden ?? false,
      }}
    );
    // Remove all old questions for this questionnaire
    await db.collection('questions').deleteMany({ questionnaire_id: questionnaireId });
    // Insert new/updated questions
    if (Array.isArray(body.questions)) {
      const questionsToInsert = body.questions.map((q: any, idx: number) => ({
        questionnaire_id: questionnaireId,
        question_id: q.question_id || `${questionnaireId}_${idx}_${Date.now()}`,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || [],
        is_required: !!q.is_required,
        display_order: idx
      }));
      if (questionsToInsert.length > 0) {
        await db.collection('questions').insertMany(questionsToInsert);
      }
    }
    return NextResponse.json({ success: true, message: 'Questionnaire updated successfully' });
  } catch (error) {
    console.error('Error updating questionnaire:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
}
