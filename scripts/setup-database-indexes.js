#!/usr/bin/env node

const { MongoClient } = require('mongodb');

// Import the indexing utility (compiled version)
const { ensureIndexes, getIndexStats } = require('../lib/database-indexes');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function setupDatabaseIndexes() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🚀 Starting database index setup...');
    await client.connect();
    const db = client.db('polmatch');
    
    // Check current state
    console.log('\n📊 Current index statistics:');
    const beforeStats = await getIndexStats(db);
    Object.entries(beforeStats).forEach(([collection, stats]) => {
      if (stats.error) {
        console.log(`  ${collection}: Error - ${stats.error}`);
      } else {
        console.log(`  ${collection}: ${stats.indexCount} indexes`);
      }
    });
    
    // Force recreate indexes for optimal performance
    const forceRecreate = process.argv.includes('--force');
    if (forceRecreate) {
      console.log('\n⚠️  Force recreating all indexes...');
    }
    
    await ensureIndexes(db, forceRecreate);
    
    // Check final state
    console.log('\n📊 Final index statistics:');
    const afterStats = await getIndexStats(db);
    Object.entries(afterStats).forEach(([collection, stats]) => {
      if (stats.error) {
        console.log(`  ${collection}: Error - ${stats.error}`);
      } else {
        console.log(`  ${collection}: ${stats.indexCount} indexes`);
        stats.indexes.forEach(idx => {
          console.log(`    - ${idx.name}: ${JSON.stringify(idx.keys)}`);
        });
      }
    });
    
    console.log('\n✅ Database index setup completed successfully!');
    console.log('\n💡 Performance Tips:');
    console.log('  - Run this script after deploying new code');
    console.log('  - Use --force flag to recreate all indexes');
    console.log('  - Monitor index usage with MongoDB Compass');
    
  } catch (error) {
    console.error('❌ Error setting up indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the setup
setupDatabaseIndexes().catch(console.error);
