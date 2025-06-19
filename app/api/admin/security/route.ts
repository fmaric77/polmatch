import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import MONGODB_URI from '../../mongo-uri';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

const client = new MongoClient(MONGODB_URI);

// GET: Fetch security data (login attempts, locks, etc.)
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify admin session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user || (!user.is_admin && !user.is_superadmin)) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'attempts') {
      // Get current login attempts and locks
      const attempts = await db.collection('login_attempts')
        .find({})
        .sort({ last_attempt: -1 })
        .limit(100)
        .toArray();
      
      return NextResponse.json({ success: true, attempts });
    }

    if (action === 'logs') {
      // Get security logs
      const logs = await db.collection('security_logs')
        .find({})
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();
      
      return NextResponse.json({ success: true, logs });
    }

    if (action === 'stats') {
      // Get security statistics
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        active_locks: await db.collection('login_attempts').countDocuments({
          locked_until: { $gt: now }
        }),
        failed_attempts_24h: await db.collection('login_attempts').countDocuments({
          last_attempt: { $gte: last24h }
        }),
        successful_logins_24h: await db.collection('security_logs').countDocuments({
          event: 'successful_login',
          timestamp: { $gte: last24h }
        }),
        failed_attempts_7d: await db.collection('login_attempts').countDocuments({
          last_attempt: { $gte: last7d }
        }),
        successful_logins_7d: await db.collection('security_logs').countDocuments({
          event: 'successful_login',
          timestamp: { $gte: last7d }
        })
      };

      return NextResponse.json({ success: true, stats });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    
  } catch (err) {
    console.error('Security API error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// DELETE: Clear login attempts (admin action)
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify admin session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user || (!user.is_admin && !user.is_superadmin)) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, target } = body;

    if (action === 'clear_attempts') {
      if (target === 'all') {
        // Clear all login attempts
        const result = await db.collection('login_attempts').deleteMany({});
        
        // Log admin action
        await db.collection('security_logs').insertOne({
          event: 'admin_clear_all_attempts',
          admin_user_id: user.user_id,
          admin_email: user.email,
          cleared_count: result.deletedCount,
          timestamp: new Date()
        });

        return NextResponse.json({ 
          success: true, 
          message: `Cleared ${result.deletedCount} login attempts`,
          cleared_count: result.deletedCount
        });
      } else if (target) {
        // Clear attempts for specific IP or email
        const result = await db.collection('login_attempts').deleteMany({
          $or: [
            { ip_address: target },
            { email: target.toLowerCase() }
          ]
        });

        // Log admin action
        await db.collection('security_logs').insertOne({
          event: 'admin_clear_specific_attempts',
          admin_user_id: user.user_id,
          admin_email: user.email,
          target,
          cleared_count: result.deletedCount,
          timestamp: new Date()
        });

        return NextResponse.json({ 
          success: true, 
          message: `Cleared ${result.deletedCount} login attempts for ${target}`,
          cleared_count: result.deletedCount
        });
      }
    }

    return NextResponse.json({ success: false, message: 'Invalid action or target' }, { status: 400 });
    
  } catch (err) {
    console.error('Security API error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}
