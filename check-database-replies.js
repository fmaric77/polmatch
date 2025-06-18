#!/usr/bin/env node
import { MongoClient } from 'mongodb';

async function checkDatabaseForReplies() {
  console.log('=== Checking Database for Reply Messages ===\n');

  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Check recent messages in the pm collection
    console.log('1. Checking recent messages in pm collection...');
    const pmMessages = await db.collection('pm').find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    console.log(`Found ${pmMessages.length} messages in pm collection:`);
    pmMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ID: ${msg._id}`);
      console.log(`     Content preview: ${msg.encrypted_content ? '[ENCRYPTED]' : (msg.content || 'No content')}`);
      console.log(`     Has reply_to: ${!!msg.reply_to}`);
      if (msg.reply_to) {
        console.log(`     Reply to: ${JSON.stringify(msg.reply_to)}`);
      }
      console.log(`     Timestamp: ${msg.timestamp}`);
      console.log('');
    });
    
    // Check for any messages with reply_to field
    console.log('2. Looking specifically for messages with reply_to field...');
    const replyMessages = await db.collection('pm').find({
      reply_to: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${replyMessages.length} messages with reply_to field:`);
    replyMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ID: ${msg._id}`);
      console.log(`     Reply to: ${JSON.stringify(msg.reply_to)}`);
      console.log('');
    });
    
    // Check other collections for profile messages
    const profileCollections = ['private_messages_basic', 'private_messages_love', 'private_messages_business'];
    
    for (const collectionName of profileCollections) {
      console.log(`3. Checking ${collectionName} collection...`);
      try {
        const profileMessages = await db.collection(collectionName).find({})
          .sort({ timestamp: -1 })
          .limit(5)
          .toArray();
          
        console.log(`Found ${profileMessages.length} messages in ${collectionName}:`);
        profileMessages.forEach((msg, index) => {
          console.log(`  ${index + 1}. ID: ${msg._id}`);
          console.log(`     Has reply_to: ${!!msg.reply_to}`);
          if (msg.reply_to) {
            console.log(`     Reply to: ${JSON.stringify(msg.reply_to)}`);
          }
        });
        
        // Check for replies in this collection
        const profileReplies = await db.collection(collectionName).find({
          reply_to: { $exists: true, $ne: null }
        }).toArray();
        
        if (profileReplies.length > 0) {
          console.log(`Found ${profileReplies.length} reply messages in ${collectionName}`);
        }
        
      } catch (error) {
        console.log(`  Collection ${collectionName} doesn't exist or error: ${error.message}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkDatabaseForReplies();
