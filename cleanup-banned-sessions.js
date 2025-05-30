const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function cleanupBannedIPSessions() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Connecting to database...');
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('📋 Fetching all banned IP addresses...');
    const bannedIPs = await db.collection('ban').find({}).toArray();
    console.log(`Found ${bannedIPs.length} banned IP addresses`);
    
    if (bannedIPs.length === 0) {
      console.log('✅ No banned IPs found, nothing to clean up');
      return;
    }
    
    // Get list of banned IP addresses
    const bannedIPList = bannedIPs.map(ban => ban.ip_address);
    console.log('Banned IPs:', bannedIPList);
    
    console.log('\n🔍 Checking for active sessions from banned IPs...');
    const activeSessions = await db.collection('sessions').find({
      ip_address: { $in: bannedIPList }
    }).toArray();
    
    console.log(`Found ${activeSessions.length} active sessions from banned IPs`);
    
    if (activeSessions.length > 0) {
      console.log('Sessions to be deleted:');
      activeSessions.forEach(session => {
        console.log(`- Session: ${session.sessionToken} from IP: ${session.ip_address} (User: ${session.user_id})`);
      });
      
      console.log('\n🧹 Deleting sessions from banned IPs...');
      const deleteResult = await db.collection('sessions').deleteMany({
        ip_address: { $in: bannedIPList }
      });
      
      console.log(`✅ Successfully deleted ${deleteResult.deletedCount} sessions from banned IPs`);
    } else {
      console.log('✅ No active sessions found from banned IPs');
    }
    
    console.log('\n📊 Summary:');
    console.log(`- Banned IPs: ${bannedIPs.length}`);
    console.log(`- Sessions cleaned: ${activeSessions.length}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
cleanupBannedIPSessions().catch(console.error);
