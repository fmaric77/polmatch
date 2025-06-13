import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../mongo-uri';

const client = new MongoClient(MONGODB_URI);

export async function GET(): Promise<NextResponse> {
  try {
    await client.connect();
    const db = client.db('polmatch');
    const jobsCollection = db.collection('job_postings');
    
    // Fetch all active job postings with poster details
    const jobs = await jobsCollection.aggregate([
      {
        $match: { is_active: true }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'posted_by',
          foreignField: 'user_id',
          as: 'poster'
        }
      },
      {
        $unwind: '$poster'
      },
      {
        $project: {
          job_id: 1,
          title: 1,
          company: 1,
          location: 1,
          salary_range: 1,
          job_type: 1,
          description: 1,
          requirements: 1,
          posted_by: 1,
          posted_by_username: '$poster.username',
          posted_by_display_name: '$poster.display_name',
          posted_at: 1,
          application_deadline: 1,
          experience_level: 1,
          industry: 1,
          is_active: 1
        }
      },
      {
        $sort: { posted_at: -1 }
      }
    ]).toArray();

    return NextResponse.json({
      success: true,
      jobs: jobs
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
