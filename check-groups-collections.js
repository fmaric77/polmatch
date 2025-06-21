const { MongoClient } = require('mongodb');

// MongoDB connection URI
const MONGODB_URI = 'mongodb://127.0.0.1:27017';

async function checkGroupsCollections() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('polmatch');
    
    // Get all collections in the database
    console.log('\n📂 ALL COLLECTIONS IN DATABASE:');
    console.log('================================');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name).sort();
    collectionNames.forEach((name, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${name}`);
    });
    
    // Filter group-related collections
    console.log('\n📁 GROUP-RELATED COLLECTIONS:');
    console.log('=============================');
    const groupCollections = collectionNames.filter(name => 
      name.includes('group') || name.includes('Groups')
    );
    groupCollections.forEach((name, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${name}`);
    });
    
    // Check main groups collection
    console.log('\n🔍 MAIN GROUPS COLLECTION ANALYSIS:');
    console.log('===================================');
    
    if (collectionNames.includes('groups')) {
      const groupsCount = await db.collection('groups').countDocuments();
      console.log(`Total groups in main collection: ${groupsCount}`);
      
      if (groupsCount > 0) {
        // Sample a few groups to see structure
        console.log('\n📋 SAMPLE GROUPS (first 5):');
        const sampleGroups = await db.collection('groups').find({}).limit(5).toArray();
        sampleGroups.forEach((group, index) => {
          console.log(`\nGroup ${index + 1}:`);
          console.log(`  ID: ${group.group_id || group._id}`);
          console.log(`  Name: ${group.name || 'N/A'}`);
          console.log(`  Profile Type: ${group.profile_type || 'NONE (legacy)'}`);
          console.log(`  Created: ${group.creation_date || group.created_at || 'N/A'}`);
          console.log(`  Private: ${group.is_private}`);
          console.log(`  Creator: ${group.creator_id || 'N/A'}`);
        });
        
        // Count groups by profile type
        console.log('\n📊 GROUPS BY PROFILE TYPE:');
        const profileTypeCounts = await db.collection('groups').aggregate([
          {
            $group: {
              _id: { $ifNull: ['$profile_type', 'LEGACY_NO_TYPE'] },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]).toArray();
        
        profileTypeCounts.forEach(result => {
          console.log(`  ${result._id}: ${result.count} groups`);
        });
      }
    } else {
      console.log('❌ No main "groups" collection found');
    }
    
    // Check profile-specific group collections
    console.log('\n🔍 PROFILE-SPECIFIC GROUP COLLECTIONS:');
    console.log('=====================================');
    
    const profileTypes = ['basic', 'love', 'business'];
    for (const profileType of profileTypes) {
      const collectionName = `groups_${profileType}`;
      if (collectionNames.includes(collectionName)) {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`\n📁 ${collectionName}: ${count} groups`);
        
        if (count > 0) {
          const sample = await db.collection(collectionName).findOne({});
          console.log(`  Sample group:`, {
            id: sample.group_id || sample._id,
            name: sample.name,
            profile_type: sample.profile_type,
            created: sample.creation_date || sample.created_at
          });
        }
      } else {
        console.log(`\n❌ ${collectionName}: Collection does not exist`);
      }
    }
    
    // Check group members collections
    console.log('\n👥 GROUP MEMBERS COLLECTIONS:');
    console.log('============================');
    
    if (collectionNames.includes('group_members')) {
      const membersCount = await db.collection('group_members').countDocuments();
      console.log(`\n📁 group_members: ${membersCount} memberships`);
      
      if (membersCount > 0) {
        // Sample membership
        const sampleMember = await db.collection('group_members').findOne({});
        console.log(`  Sample membership:`, {
          group_id: sampleMember.group_id,
          user_id: sampleMember.user_id,
          role: sampleMember.role,
          join_date: sampleMember.join_date
        });
        
        // Count memberships by group to see distribution
        console.log('\n📊 TOP 5 GROUPS BY MEMBER COUNT:');
        const topGroups = await db.collection('group_members').aggregate([
          {
            $group: {
              _id: '$group_id',
              memberCount: { $sum: 1 }
            }
          },
          { $sort: { memberCount: -1 } },
          { $limit: 5 }
        ]).toArray();
        
        for (const groupStat of topGroups) {
          // Get group name
          const groupInfo = await db.collection('groups').findOne({ group_id: groupStat._id });
          console.log(`  ${groupStat._id}: ${groupStat.memberCount} members (${groupInfo?.name || 'Unknown'})`);
        }
      }
    }
    
    // Check profile-specific member collections
    for (const profileType of profileTypes) {
      const collectionName = `group_members_${profileType}`;
      if (collectionNames.includes(collectionName)) {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`\n📁 ${collectionName}: ${count} memberships`);
      } else {
        console.log(`\n❌ ${collectionName}: Collection does not exist`);
      }
    }
    
    // Summary and recommendations
    console.log('\n📝 SUMMARY & RECOMMENDATIONS:');
    console.log('=============================');
    
    const hasLegacyGroups = collectionNames.includes('groups');
    const hasProfileGroups = profileTypes.some(type => 
      collectionNames.includes(`groups_${type}`)
    );
    
    if (hasLegacyGroups && hasProfileGroups) {
      console.log('⚠️  MIXED SYSTEM DETECTED:');
      console.log('   - Legacy groups exist in main "groups" collection');
      console.log('   - Profile-specific collections also exist');
      console.log('   - Need to migrate legacy groups to profile-specific collections');
    } else if (hasLegacyGroups && !hasProfileGroups) {
      console.log('📜 LEGACY SYSTEM:');
      console.log('   - Only main "groups" collection exists');
      console.log('   - Need to create profile-specific collections');
    } else if (!hasLegacyGroups && hasProfileGroups) {
      console.log('✅ PROFILE-SPECIFIC SYSTEM:');
      console.log('   - Only profile-specific collections exist');
      console.log('   - System is properly separated');
    } else {
      console.log('❓ NO GROUPS FOUND');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the analysis
console.log('🔍 Starting Groups Collections Analysis...');
checkGroupsCollections().catch(console.error);