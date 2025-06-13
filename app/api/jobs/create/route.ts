import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import MONGODB_URI from '../../mongo-uri';

const client = new MongoClient(MONGODB_URI);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      company,
      location,
      salary_range,
      job_type,
      description,
      requirements,
      application_deadline,
      experience_level,
      industry
    } = body;

    // Validate required fields
    if (!title || !company || !location || !job_type || !description || !experience_level) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }

    await client.connect();
    const db = client.db('polmatch');
    const jobsCollection = db.collection('job_postings');
    const usersCollection = db.collection('users');

    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'Invalid session'
      }, { status: 401 });
    }

    // Verify user exists and has business profile
    const user = await usersCollection.findOne({ user_id: session.user_id });
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    // Check if user has business profile
    const businessProfile = await db.collection('businessprofiles').findOne({
      user_id: session.user_id
    });

    if (!businessProfile) {
      return NextResponse.json({
        success: false,
        message: 'Business profile required to post jobs'
      }, { status: 403 });
    }

    const jobId = uuidv4();
    const now = new Date();

    const jobPosting = {
      job_id: jobId,
      title,
      company,
      location,
      salary_range: salary_range || '',
      job_type,
      description,
      requirements: requirements || [],
      posted_by: session.user_id,
      posted_at: now,
      application_deadline: application_deadline ? new Date(application_deadline) : null,
      experience_level,
      industry: industry || '',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    await jobsCollection.insertOne(jobPosting);

    return NextResponse.json({
      success: true,
      message: 'Job posting created successfully',
      job_id: jobId
    });
  } catch (error) {
    console.error('Error creating job posting:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await client.close();
  }
}
