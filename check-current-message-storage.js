const { MongoClient } = require('mongodb');

async function checkCurrentMessageStorage() {
  console.log('🔍 Starting database check...\n');
  
  const client = new MongoClient('mongodb://localhost:27017', {
    serverSelectionTimeoutMS: 5000
  });
  
  try {
    console.log('📡 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    const db = client.db('polmatch');
    
    console.log('\n=== CHECKING CURRENT MESSAGE STORAGE ===\n');
    
    // List all collections to see what exists
    console.log('📋 Getting collections list...');
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    console.log('\n🔍 CHECKING MESSAGE COLLECTIONS:\n');
    
    // Check different possible message collections
    const possibleMessageCollections = [
      'pm',
      'private_messages_basic',
      'private_messages_love', 
      'private_messages_business',
      'private_conversations_basic',
      'private_conversations_love',
      'private_conversations_business',
      'private_conversations'
    ];
    
    for (const collectionName of possibleMessageCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`📊 ${collectionName}: ${count} documents`);
        
        if (count > 0) {
          // Get a sample document to understand structure
          const sample = await db.collection(collectionName).findOne();
          console.log(`   Sample document structure:`);
          console.log(`   - Has participant_ids: ${!!sample.participant_ids}`);
          console.log(`   - Has sender_id: ${!!sample.sender_id}`);
          console.log(`   - Has encrypted_content: ${!!sample.encrypted_content}`);
          console.log(`   - Has content: ${!!sample.content}`);
          console.log(`   - Has timestamp: ${!!sample.timestamp}`);
          console.log(`   - Has profile_context: ${!!sample.profile_context} ${sample.profile_context ? `(${sample.profile_context})` : ''}`);
          console.log(`   - Has created_at: ${!!sample.created_at}`);
          console.log(`   - Has updated_at: ${!!sample.updated_at}`);
          
          // If it looks like a conversation (has created_at/updated_at), check for messages
          if (sample.created_at && sample.updated_at && !sample.encrypted_content) {
            console.log(`   ⚠️  This looks like a CONVERSATION collection, not messages`);
          }
          // If it looks like a message (has encrypted_content/content), it's a message
          else if (sample.encrypted_content || (sample.content && sample.sender_id)) {
            console.log(`   ✅ This looks like a MESSAGE collection`);
            
            // Get recent messages
            const recentMessages = await db.collection(collectionName)
              .find()
              .sort({ timestamp: -1 })
              .limit(3)
              .toArray();
            
            console.log(`   📨 Recent messages:`);
            recentMessages.forEach((msg, i) => {
              console.log(`     ${i+1}. From: ${msg.sender_id?.substring(0, 8)}... | Context: ${msg.profile_context || 'none'} | Time: ${msg.timestamp}`);
            });
          }
        }
        console.log('');
      } catch (error) {
        console.log(`❌ ${collectionName}: Collection doesn't exist or error: ${error.message}`);
      }
    }
    
    console.log('\n🔍 LOOKING FOR RECENT BASIC PROFILE MESSAGES:\n');
    
    // Specifically check for basic profile messages in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    for (const collectionName of possibleMessageCollections) {
      try {
        const recentBasicMessages = await db.collection(collectionName).find({
          $or: [
            { profile_context: { $regex: /basic/ } },
            { profile_context: 'basic_basic' }
          ],
          timestamp: { $gte: oneHourAgo }
        }).sort({ timestamp: -1 }).toArray();
        
        if (recentBasicMessages.length > 0) {
          console.log(`📨 Found ${recentBasicMessages.length} recent basic messages in ${collectionName}:`);
          recentBasicMessages.forEach((msg, i) => {
            console.log(`  ${i+1}. From: ${msg.sender_id?.substring(0, 8)}... | Context: ${msg.profile_context} | Time: ${msg.timestamp}`);
            if (msg.content && !msg.encrypted_content) {
              console.log(`      Content: "${msg.content}"`);
            } else if (msg.encrypted_content) {
              console.log(`      Encrypted content exists`);
            }
          });
        }
      } catch (error) {
        // Skip collections that don't exist
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkCurrentMessageStorage();
