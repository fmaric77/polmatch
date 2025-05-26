const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function checkSchema() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Checking group_messages schema ===');
    const sampleMessage = await db.collection('group_messages').findOne({});
    console.log('Sample message fields:', Object.keys(sampleMessage || {}));
    console.log('Sample message:', JSON.stringify(sampleMessage, null, 2));
    
    console.log('\n=== Checking for messages with channel_id ===');
    const channelMessage = await db.collection('group_messages').findOne({ channel_id: { $exists: true } });
    if (channelMessage) {
      console.log('Channel message fields:', Object.keys(channelMessage));
      console.log('Channel message sample:', JSON.stringify(channelMessage, null, 2));
    } else {
      console.log('No messages with channel_id found');
    }
    
    console.log('\n=== Checking field variations ===');
    const contentField = await db.collection('group_messages').findOne({ content: { $exists: true } });
    const encryptedContentField = await db.collection('group_messages').findOne({ encrypted_content: { $exists: true } });
    
    console.log('Has content field:', !!contentField);
    console.log('Has encrypted_content field:', !!encryptedContentField);
    
    if (contentField) {
      console.log('Content field sample:', contentField.content?.substring(0, 50) + '...');
    }
    if (encryptedContentField) {
      console.log('Encrypted_content field sample:', encryptedContentField.encrypted_content?.substring(0, 50) + '...');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkSchema(); 