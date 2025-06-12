import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

export async function GET() {
  // Auth check
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all users with their profile data using aggregation
    const usersWithProfiles = await db.collection('users').aggregate([
      {
        $lookup: {
          from: 'basicprofiles',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'basicProfile'
        }
      },
      {
        $lookup: {
          from: 'loveprofiles', 
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'loveProfile'
        }
      },
      {
        $lookup: {
          from: 'businessprofiles',
          localField: 'user_id', 
          foreignField: 'user_id',
          as: 'businessProfile'
        }
      },
      {
        $project: {
          user_id: 1,
          username: 1,
          email: 1,
          display_name: {
            $cond: {
              if: { $gt: [{ $size: '$basicProfile' }, 0] },
              then: { $arrayElemAt: ['$basicProfile.display_name', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$loveProfile' }, 0] },
                  then: { $arrayElemAt: ['$loveProfile.display_name', 0] },
                  else: { $arrayElemAt: ['$businessProfile.display_name', 0] }
                }
              }
            }
          }
        }
      }
    ]).toArray();
    
    return NextResponse.json({ success: true, users: usersWithProfiles });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch users', error: String(err) });
  } finally {
    await client.close();
  }
}
