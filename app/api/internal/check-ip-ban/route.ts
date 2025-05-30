import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify this is an internal request
    const internalHeader = request.headers.get('x-internal-request');
    if (internalHeader !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ip_address } = await request.json();
    
    if (!ip_address || ip_address === 'unknown') {
      return NextResponse.json({ banned: false });
    }

    // Connect to MongoDB and check ban status
    const client = new MongoClient(MONGODB_URI);
    
    try {
      await client.connect();
      const db = client.db('polmatch');
      
      // Check if IP exists in ban collection
      const ban = await db.collection('ban').findOne({ ip_address });
      
      return NextResponse.json({ 
        banned: ban !== null,
        ban_date: ban?.ban_date || null 
      });
      
    } finally {
      await client.close();
    }
    
  } catch (error) {
    console.error('Error checking IP ban status:', error);
    return NextResponse.json({ banned: false }, { status: 500 });
  }
}
