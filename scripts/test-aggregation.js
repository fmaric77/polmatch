const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testAggregation() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Get a sample group and channel ID
    const sampleMessage = await db.collection('group_messages').findOne({ channel_id: { $exists: true } });
    if (!sampleMessage) {
      console.log('No channel messages found');
      return;
    }
    
    const groupId = sampleMessage.group_id;
    const channelId = sampleMessage.channel_id;
    
    console.log('Testing aggregation for:', { groupId, channelId });
    
    // Test the exact aggregation pipeline from the API (FIXED VERSION)
    const messages = await db.collection('group_messages').aggregate([
      { $match: { group_id: groupId, channel_id: channelId } },
      { $sort: { timestamp: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'sender_id',
          foreignField: 'user_id',
          as: 'sender',
          pipeline: [{ $project: { user_id: 1, username: 1 } }]
        }
      },
      { $unwind: '$sender' },
      {
        $project: {
          message_id: 1,
          group_id: 1,
          channel_id: 1,
          sender_id: 1,
          // Handle both field names - some messages use 'content', others use 'encrypted_content'
          content: { 
            $cond: { 
              if: { $ifNull: ['$content', false] }, 
              then: '$content', 
              else: '$encrypted_content' 
            } 
          },
          timestamp: 1,
          attachments: 1,
          sender_username: '$sender.username'
        }
      },
      { $sort: { timestamp: 1 } }
    ]).toArray();
    
    console.log('Aggregation result count:', messages.length);
    console.log('First message fields:', Object.keys(messages[0] || {}));
    console.log('First message:', JSON.stringify(messages[0], null, 2));
    
    // Test without aggregation
    console.log('\n=== Testing direct query ===');
    const directMessages = await db.collection('group_messages').find({
      group_id: groupId,
      channel_id: channelId
    }).limit(2).toArray();
    
    console.log('Direct query result count:', directMessages.length);
    console.log('Direct message fields:', Object.keys(directMessages[0] || {}));
    console.log('Direct message:', JSON.stringify(directMessages[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testAggregation(); 