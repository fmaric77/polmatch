import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import MONGODB_URI from '../mongo-uri';

const client = new MongoClient(MONGODB_URI);

interface DBUser {
  user_id: string;
  is_admin?: boolean;
}

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

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { job_id } = await request.json();

    if (!job_id) {
      return NextResponse.json({
        success: false,
        message: 'Job ID is required'
      }, { status: 400 });
    }

    // Get session from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session and get user
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'Invalid session'
      }, { status: 401 });
    }

    const jobsCollection = db.collection('job_postings');
    
  // Find the job posting to verify ownership
    const job = await jobsCollection.findOne({ job_id: job_id });
    if (!job) {
      return NextResponse.json({
        success: false,
        message: 'Job posting not found'
      }, { status: 404 });
    }

  // Fetch user to determine admin status
  const usersCollection = db.collection<DBUser>('users');
  const user = await usersCollection.findOne({ user_id: session.user_id });

  // Verify the user owns this job posting OR is an admin
  const isAdmin = Boolean(user?.is_admin);
  if (!isAdmin && job.posted_by !== session.user_id) {
      return NextResponse.json({
        success: false,
        message: 'You can only delete your own job postings'
      }, { status: 403 });
    }

    // Soft delete by setting is_active to false
    const result = await jobsCollection.updateOne(
      { job_id: job_id },
      { 
        $set: { 
          is_active: false,
          deleted_at: new Date().toISOString()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to delete job posting'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Job posting deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
