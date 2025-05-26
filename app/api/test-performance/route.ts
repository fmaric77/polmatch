import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb-connection';

// Performance test endpoint that bypasses authentication
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Test database connection and basic operations
    const { db } = await connectToDatabase();
    
    // Test 1: Simple collection count (should be fast with indexes)
    const userCount = await db.collection('users').countDocuments();
    
    // Test 2: Simple aggregation pipeline (tests indexed queries)
    const sampleUsers = await db.collection('users').aggregate([
      { $match: { email: { $exists: true } } },
      { $limit: 5 },
      { $project: { username: 1, email: 1 } }
    ]).toArray();
    
    // Test 3: More complex aggregation (similar to what our optimized routes do)
    const recentActivity = await db.collection('sessions').aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
      { $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $limit: 10 }
    ]).toArray();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return NextResponse.json({
      success: true,
      performanceTest: {
        duration: `${duration}ms`,
        userCount,
        sampleUsersFound: sampleUsers.length,
        recentActivityFound: recentActivity.length,
        connectionStatus: 'connected'
      }
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('Performance test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}
