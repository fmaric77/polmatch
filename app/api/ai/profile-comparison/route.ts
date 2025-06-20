import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';
import OpenAI from "openai";

const grokClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

interface ProfileData {
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  questionnaire_answers: Array<{
    question_text: string;
    answer: string;
    profile_display_text?: string;
    questionnaire_title: string;
    group_title: string;
  }>;
}

// POST: Compare two user profiles using Grok AI
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Check if Grok API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('GROK_API_KEY environment variable is missing');
    return NextResponse.json({ 
      success: false, 
      message: 'AI service configuration error' 
    }, { status: 500 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { other_user_id, profile_type } = await request.json();
    
    if (!other_user_id || !profile_type || !['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Valid other_user_id and profile_type are required' 
      }, { status: 400 });
    }

    const currentUserId = session.user_id;
    
    // Helper function to get user profile data
    async function getUserProfileData(userId: string): Promise<ProfileData> {
      // Get basic user info
      const user = await db.collection('users').findOne(
        { user_id: userId },
        { projection: { user_id: 1, username: 1 } }
      );
      
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Get profile info
      const profileCollectionName = `${profile_type}profiles`;
      const profile = await db.collection(profileCollectionName).findOne(
        { user_id: userId },
        { projection: { display_name: 1, bio: 1 } }
      );

      // Get questionnaire answers
      const answers = await db.collection('user_questionnaire_answers').aggregate([
        { $match: { user_id: userId } },
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
            'group.profile_type': profile_type,
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
        { $unwind: '$question' },
        {
          $project: {
            question_text: '$question.question_text',
            answer: '$answer',
            profile_display_text: '$question.profile_display_text',
            questionnaire_title: '$questionnaire.title',
            group_title: '$group.title'
          }
        },
        { $sort: { group_title: 1, questionnaire_title: 1 } }
      ]).toArray();

      return {
        user_id: userId,
        username: user.username,
        display_name: profile?.display_name,
        bio: profile?.bio,
        questionnaire_answers: answers as Array<{
          question_text: string;
          answer: string;
          profile_display_text?: string;
          questionnaire_title: string;
          group_title: string;
        }>
      };
    }

    // Get both users' profile data
    const [currentUserProfile, otherUserProfile] = await Promise.all([
      getUserProfileData(currentUserId),
      getUserProfileData(other_user_id)
    ]);

    // Prepare data for AI analysis
    const currentUserData = {
      name: currentUserProfile.display_name || currentUserProfile.username,
      bio: currentUserProfile.bio || "No bio provided",
      answers: currentUserProfile.questionnaire_answers.map(a => ({
        question: a.profile_display_text || a.question_text,
        answer: a.answer,
        category: `${a.group_title} - ${a.questionnaire_title}`
      }))
    };

    const otherUserData = {
      name: otherUserProfile.display_name || otherUserProfile.username,
      bio: otherUserProfile.bio || "No bio provided", 
      answers: otherUserProfile.questionnaire_answers.map(a => ({
        question: a.profile_display_text || a.question_text,
        answer: a.answer,
        category: `${a.group_title} - ${a.questionnaire_title}`
      }))
    };

    // Create AI prompt based on profile type
    let analysisCategories = '';
    let contextualGuidance = '';
    
    switch (profile_type) {
      case 'love':
        analysisCategories = `
## 💕 Romantic Compatibility Score
Provide a percentage (0-100%) with a brief explanation for dating potential.

## 💝 Shared Values & Interests
What romantic and life values do they share?

## 🌟 Complementary Differences
How their differences could create romantic chemistry and balance.

## 💑 Dating Insights
How they might work together as a romantic couple.

## 💬 Date Conversation Starters
Provide 4-5 romantic and personal topics perfect for dates.`;
        contextualGuidance = 'Focus on romantic compatibility, dating potential, emotional connection, and relationship dynamics. Consider lifestyle compatibility, values alignment, and romantic chemistry.';
        break;
        
      case 'business':
        analysisCategories = `
## 🎯 Professional Compatibility Score
Provide a percentage (0-100%) with a brief explanation for business collaboration.

## 🤝 Shared Professional Values
What business values, work ethics, and professional goals do they share?

## ⚖️ Complementary Skills
How their different strengths could benefit a business partnership.

## 💼 Collaboration Insights
How they might work together professionally or in business ventures.

## 📊 Business Discussion Topics
Provide 4-5 professional topics they could explore for potential collaboration.`;
        contextualGuidance = 'Focus on professional compatibility, business collaboration potential, work styles, entrepreneurial synergy, and professional networking. Consider complementary skills, shared business values, and collaboration opportunities.';
        break;
        
      default: // basic/general
        analysisCategories = `
## 🎯 Friendship Compatibility Score
Provide a percentage (0-100%) with a brief explanation for friendship potential.

## 🤝 Common Ground
What interests, values, and perspectives do they share?

## 🔄 Enriching Differences
How their differences could lead to interesting exchanges and mutual growth.

## 👥 Friendship Insights
How they might connect as friends or social contacts.

## 🗣️ Conversation Starters
Provide 4-5 engaging topics they could discuss to build a friendship.`;
        contextualGuidance = 'Focus on friendship compatibility, social connection, shared interests, intellectual compatibility, and platonic relationship potential. Avoid romantic or business contexts.';
        break;
    }

    const prompt = `You are Grok, a witty and insightful AI assistant. Analyze these two user profiles and provide a compatibility comparison for ${profile_type === 'love' ? 'dating/romantic' : profile_type === 'business' ? 'professional/business' : 'friendship/social'} purposes.

IMPORTANT: Base your analysis ONLY on the questionnaire data provided below. Do not make assumptions or create fictional details. If there is insufficient information for any section, clearly state "Not enough information available" for that specific area.

Profile Context: ${profile_type.charAt(0).toUpperCase() + profile_type.slice(1)} Profile Analysis

User 1 (Current User):
Name: ${currentUserData.name}
Bio: ${currentUserData.bio}
Questionnaire Answers (${currentUserData.answers.length} total):
${currentUserData.answers.length > 0 ? currentUserData.answers.map(a => `- ${a.question}: ${a.answer} (${a.category})`).join('\n') : 'No questionnaire answers available'}

User 2 (Profile Being Viewed):
Name: ${otherUserData.name}
Bio: ${otherUserData.bio}
Questionnaire Answers (${otherUserData.answers.length} total):
${otherUserData.answers.length > 0 ? otherUserData.answers.map(a => `- ${a.question}: ${a.answer} (${a.category})`).join('\n') : 'No questionnaire answers available'}

Please provide a clean, well-formatted analysis with the following sections (use markdown formatting):
${analysisCategories}

ANALYSIS GUIDELINES:
- ${contextualGuidance}
- Only reference information explicitly provided in the questionnaire answers above
- If users have few or no questionnaire answers, state this limitation clearly
- Do not invent personality traits, interests, or characteristics not mentioned in the data
- If you cannot provide meaningful analysis due to lack of data, say "Not enough information available" for that section
- Be honest about data limitations while still being helpful where possible

Keep your tone witty but professional. Do not include your reasoning process - just provide the final analysis based strictly on the available data.`;

    // Get AI response
    const completion = await grokClient.chat.completions.create({
      model: "grok-2-latest",
      messages: [
        {
          role: "system",
          content: "You are Grok, a professional relationship analysis AI. Provide well-structured, markdown-formatted compatibility analyses. Be witty but concise. Focus on actionable insights rather than explaining your reasoning process."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.6
    });

    const aiAnalysis = completion.choices[0].message.content;

    return NextResponse.json({ 
      success: true, 
      analysis: aiAnalysis,
      current_user: {
        name: currentUserData.name,
        answers_count: currentUserData.answers.length
      },
      other_user: {
        name: otherUserData.name,
        answers_count: otherUserData.answers.length
      },
      profile_type
    });

  } catch (error) {
    console.error('Error generating profile comparison:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to generate AI analysis' 
    }, { status: 500 });
  }
} 