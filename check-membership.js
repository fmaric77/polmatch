const { MongoClient } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function checkMembership() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('polmatch');
  
  console.log('Checking group memberships for user sokol...');
  
  // Get user ID for sokol
  const user = await db.collection('users').findOne({ email: 'sokol@example.com' });
  console.log('User ID:', user?.user_id);
  
  // Check group memberships
  const memberships = await db.collection('group_members').find({
    user_id: user?.user_id
  }).toArray();
  
  console.log('User memberships:', memberships.length);
  memberships.forEach(m => {
    console.log('- Group ID:', m.group_id);
  });
  
  // Check if user is member of the public group
  const publicGroup = await db.collection('groups').findOne({
    name: 'Ioans public group'
  });
  console.log('Public group ID:', publicGroup?.group_id);
  
  const isAlreadyMember = memberships.some(m => m.group_id === publicGroup?.group_id);
  console.log('Is user already a member of public group?', isAlreadyMember);
  
  await client.close();
}

checkMembership().catch(console.error);
