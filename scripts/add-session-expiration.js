const { MongoClient } = require('mongodb');

async function addExpirationToExistingSessions() {
  const client = new MongoClient('mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('Adding expiration to existing sessions...');
    
    // Add expires field to all existing sessions (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const result = await db.collection('sessions').updateMany(
      { expires: { $exists: false } }, // Sessions without expires field
      { 
        $set: { 
          expires: expiresAt,
          updated_at: new Date()
        } 
      }
    );
    
    console.log(`✅ Added expiration to ${result.modifiedCount} sessions`);
    
    // Also clean up very old sessions (older than 30 days)
    const oldSessionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleteResult = await db.collection('sessions').deleteMany({
      created_at: { $lt: oldSessionCutoff }
    });
    
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} old sessions`);
    
    // Show current session stats
    const totalSessions = await db.collection('sessions').countDocuments({});
    const activeSessions = await db.collection('sessions').countDocuments({
      expires: { $gt: new Date() }
    });
    
    console.log(`📊 Total sessions: ${totalSessions}, Active sessions: ${activeSessions}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

addExpirationToExistingSessions();
