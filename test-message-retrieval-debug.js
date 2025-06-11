const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

// Test credentials from the performance test instructions
const testUser = {
  email: 'sokol@example.com',
  password: 'mango'
};

async function debugMessageRetrieval() {
  console.log('🧪 Testing Message Retrieval for Profile-Specific Collections');
  console.log('=' * 60);

  try {
    // 1. Login to get session
    console.log('\n🔐 Logging in...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }

    const loginData = await loginResponse.json();
    const sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');

    // 2. Check what users are available for each profile type
    console.log('\n👥 Checking available users for each profile type...');
    const profileTypes = ['basic', 'love', 'business'];
    
    for (const profileType of profileTypes) {
      const discoverResponse = await fetch(`http://localhost:3000/api/users/discover?profile_type=${profileType}&sender_profile_type=${profileType}`, {
        headers: { Cookie: sessionCookie }
      });

      if (discoverResponse.ok) {
        const discoverData = await discoverResponse.json();
        console.log(`  ${profileType}: ${discoverData.users.length} users available`);
        
        if (discoverData.users.length > 0) {
          const firstUser = discoverData.users[0];
          console.log(`    First user: ${firstUser.username} (${firstUser.user_id})`);
          
          // 3. Try to fetch messages for this user with profile context
          console.log(`\n📨 Fetching ${profileType} messages for ${firstUser.username}...`);
          
          const messagesResponse = await fetch(`http://localhost:3000/api/messages?user_id=${firstUser.user_id}&sender_profile_type=${profileType}&receiver_profile_type=${profileType}`, {
            headers: { Cookie: sessionCookie }
          });

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            console.log(`    ✅ API Response: ${messagesData.success ? 'Success' : 'Failed'}`);
            console.log(`    📊 Messages found: ${messagesData.messages ? messagesData.messages.length : 0}`);
            
            if (messagesData.messages && messagesData.messages.length > 0) {
              console.log(`    📝 Sample message: "${messagesData.messages[0].content}"`);
              console.log(`    🏷️  Profile context: ${messagesData.messages[0].profile_context || 'none'}`);
            }
          } else {
            console.log(`    ❌ Failed to fetch messages: ${messagesResponse.status}`);
          }
        }
      }
    }

    // 4. Direct database check to compare
    console.log('\n🗄️  Direct Database Check:');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('polmatch');

    for (const profileType of profileTypes) {
      const collectionName = `pm_${profileType}`;
      try {
        const count = await db.collection(collectionName).countDocuments({});
        console.log(`  ${collectionName}: ${count} messages in database`);
        
        if (count > 0) {
          const messages = await db.collection(collectionName).find({}).limit(3).toArray();
          messages.forEach((msg, i) => {
            console.log(`    Message ${i + 1}: profile_context="${msg.profile_context || 'none'}", participants=${JSON.stringify(msg.participant_ids)}`);
          });
        }
      } catch (error) {
        console.log(`  ${collectionName}: Collection doesn't exist or error: ${error.message}`);
      }
    }

    await client.close();

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugMessageRetrieval();
