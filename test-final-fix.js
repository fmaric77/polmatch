const { MongoClient, ObjectId } = require('mongodb');

async function testMessageDeletion() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔍 Testing message deletion with the fix...');
    
    // Get a recent message from group_messages
    const recentMessage = await db.collection('group_messages').findOne({}, { sort: { timestamp: -1 } });
    
    if (!recentMessage) {
      console.log('❌ No messages found in group_messages collection');
      return;
    }
    
    console.log('📝 Found test message:');
    console.log(`  _id: ${recentMessage._id}`);
    console.log(`  message_id: ${recentMessage.message_id}`);
    console.log(`  group_id: ${recentMessage.group_id}`);
    console.log(`  channel_id: ${recentMessage.channel_id}`);
    
    // Test the backend DELETE endpoint with the correct field mapping
    const deleteBody = {
      messageId: recentMessage._id.toString() // Frontend sends _id as messageId
    };
    
    console.log('\n🧪 Testing DELETE request with body:', deleteBody);
    
    const response = await fetch(`http://localhost:3003/api/groups/${recentMessage.group_id}/channels/${recentMessage.channel_id}/messages`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session=your_session_token_here' // Replace with actual session
      },
      body: JSON.stringify(deleteBody)
    });
    
    console.log(`\n📊 Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Response data:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await client.close();
  }
}

testMessageDeletion();
