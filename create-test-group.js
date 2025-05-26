const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function createTestPublicGroup() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('polmatch');
  
  console.log('Creating a new public group for testing discovery...');
  
  const newGroup = {
    _id: uuidv4(),
    group_id: uuidv4(),
    name: "Test Public Group for Discovery",
    description: "This is a test public group to verify discovery functionality",
    creator_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", // sokol's ID
    creation_date: new Date(),
    is_private: false,
    members_count: 1,
    topic: "testing",
    status: "active",
    last_activity: new Date()
  };
  
  await db.collection('groups').insertOne(newGroup);
  console.log('Created new public group:', newGroup.group_id);
  console.log('Name:', newGroup.name);
  
  await client.close();
}

createTestPublicGroup().catch(console.error);
