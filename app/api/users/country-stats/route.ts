import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';

const client = new MongoClient(MONGODB_URI);


export async function GET() {
  try {
    await client.connect();
    const db = client.db('polmatch');

    // Aggregate answers for the 'countryofcurrentresidence' question
    const answers = await db.collection('user_questionnaire_answers').aggregate([
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
        $match: {
          'question.question_type': 'countryofcurrentresidence',
          answer: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$answer',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          country: '$_id',
          count: 1,
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    const totalResponses = answers.reduce((sum, a) => sum + a.count, 0);
    const formattedStats = answers.map((stat) => ({
      country: stat.country,
      count: stat.count,
      percentage: totalResponses > 0 ? ((stat.count / totalResponses) * 100).toFixed(1) : '0.0'
    }));

    return NextResponse.json({
      success: true,
      totalUsers: totalResponses,
      countryStats: formattedStats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching country stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch country statistics',
        error: String(error)
      },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}
