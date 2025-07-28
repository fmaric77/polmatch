import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

const client = new MongoClient(MONGODB_URI);

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: Get specific questionnaire with questions for user
export async function GET(req: NextRequest, context: RouteContext) {
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

    const params = await context.params;
    const questionnaireId = params.id;

    // Get questionnaire with questions
    const questionnaire = await db.collection('questionnaires').findOne({ 
      questionnaire_id: questionnaireId,
      is_hidden: false
    });

    if (!questionnaire) {
      return NextResponse.json({ 
        success: false, 
        message: 'Questionnaire not found' 
      }, { status: 404 });
    }

    // Get questions
    const questions = await db.collection('questions')
      .find({ questionnaire_id: questionnaireId })
      .sort({ display_order: 1 })
      .toArray();

    // Get user's existing answers
    const existingAnswers = await db.collection('user_questionnaire_answers')
      .find({ 
        user_id: session.user_id,
        questionnaire_id: questionnaireId
      })
      .toArray();

    // Map answers to questions with visibility settings
    const answersMap = new Map(existingAnswers.map(answer => [answer.question_id, { 
      answer: answer.answer, 
      visibility: answer.visibility || 'public' 
    }]));
    questions.forEach(question => {
      const existingAnswer = answersMap.get(question.question_id);
      question.user_answer = existingAnswer?.answer || '';
      question.user_visibility = existingAnswer?.visibility || 'public';
    });

    return NextResponse.json({ 
      success: true, 
      questionnaire: {
        ...questionnaire,
        questions
      }
    });

  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}

// POST: Submit questionnaire answers
export async function POST(req: NextRequest, context: RouteContext) {
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

    const params = await context.params;
    const questionnaireId = params.id;

    // Verify questionnaire exists
    const questionnaire = await db.collection('questionnaires').findOne({ 
      questionnaire_id: questionnaireId,
      is_hidden: false
    });

    if (!questionnaire) {
      return NextResponse.json({ 
        success: false, 
        message: 'Questionnaire not found' 
      }, { status: 404 });
    }

    const { answers } = await req.json();

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Answers array is required' 
      }, { status: 400 });
    }

    // Get questions to validate answers
    const questions = await db.collection('questions')
      .find({ questionnaire_id: questionnaireId })
      .toArray();

    const questionMap = new Map(questions.map(q => [q.question_id, q]));

    // Validate answers
    for (const answer of answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) {
        return NextResponse.json({ 
          success: false, 
          message: `Invalid question_id: ${answer.question_id}` 
        }, { status: 400 });
      }

      if (question.is_required && (!answer.answer || answer.answer.trim() === '')) {
        return NextResponse.json({ 
          success: false, 
          message: `Answer is required for question: ${question.question_text}` 
        }, { status: 400 });
      }

      // Validate visibility setting
      const visibility = answer.visibility || 'public';
      if (!['public', 'friends', 'private'].includes(visibility)) {
        return NextResponse.json({ 
          success: false, 
          message: `Invalid visibility setting for question: ${answer.question_id}. Must be 'public', 'friends', or 'private'` 
        }, { status: 400 });
      }
    }

    // Check if all questions are answered (for completion status)
    const totalQuestions = questions.length;
    const answeredQuestions = answers.filter(answer => answer.answer && answer.answer.trim() !== '').length;
    const isCompleted = answeredQuestions === totalQuestions;

    // Delete existing answers for this questionnaire
    await db.collection('user_questionnaire_answers').deleteMany({
      user_id: session.user_id,
      questionnaire_id: questionnaireId
    });

    // Insert new answers
    const completionDate = new Date();
    const answerDocuments = answers.map(answer => ({
      user_id: session.user_id,
      questionnaire_id: questionnaireId,
      question_id: answer.question_id,
      answer: answer.answer,
      visibility: answer.visibility || 'public', // Default to 'public' if not provided
      completion_date: completionDate
    }));

    if (answerDocuments.length > 0) {
      await db.collection('user_questionnaire_answers').insertMany(answerDocuments);
    }

    // Update user's completed questionnaires in profile only if truly completed
    const questionnaireGroup = await db.collection('questionnaire_groups').findOne({
      group_id: questionnaire.group_id
    });

    if (questionnaireGroup) {
      const profileType = questionnaireGroup.profile_type;
      const collectionName = `${profileType}profiles`;
      
      if (isCompleted) {
        // Mark as completed only when all questions are answered
        await db.collection(collectionName).updateOne(
          { user_id: session.user_id },
          { 
            $set: { 
              [`completed_questionnaires.${questionnaireId}`]: true,
              last_updated: new Date().toISOString()
            }
          },
          { upsert: true }
        );
      } else {
        // Remove from completed questionnaires if not fully completed
        await db.collection(collectionName).updateOne(
          { user_id: session.user_id },
          { 
            $unset: { 
              [`completed_questionnaires.${questionnaireId}`]: 1
            },
            $set: {
              last_updated: new Date().toISOString()
            }
          },
          { upsert: true }
        );
      }

      // Add to searchable answers for profile matching only if completed
      if (isCompleted) {
        const searchableAnswers = answers.map(answer => ({
          question_id: answer.question_id,
          answer_value: answer.answer,
          user_id: session.user_id,
          questionnaire_id: questionnaireId,
          profile_type: profileType
        }));

        // Remove existing searchable answers for this questionnaire
        await db.collection('searchable_questionnaire_answers').deleteMany({
          user_id: session.user_id,
          questionnaire_id: questionnaireId
        });

        // Add new searchable answers
        if (searchableAnswers.length > 0) {
          await db.collection('searchable_questionnaire_answers').insertMany(searchableAnswers);
        }
      } else {
        // Remove from searchable answers if not completed
        await db.collection('searchable_questionnaire_answers').deleteMany({
          user_id: session.user_id,
          questionnaire_id: questionnaireId
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: isCompleted 
        ? 'Questionnaire completed successfully!' 
        : `Progress saved! You have answered ${answeredQuestions} out of ${totalQuestions} questions. Complete all questions to finish the questionnaire.`
    });

  } catch (error) {
    console.error('Error submitting questionnaire:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
