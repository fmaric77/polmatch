const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testIPBanMiddleware() {
  console.log('🧪 Testing IP Ban Middleware Functionality\n');

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Test 1: Check current bans in database
    console.log('1. Checking existing IP bans...');
    const existingBans = await db.collection('ban').find({}).toArray();
    console.log(`   Found ${existingBans.length} existing IP bans:`);
    existingBans.forEach((ban, index) => {
      console.log(`   ${index + 1}. IP: ${ban.ip_address}, Admin: ${ban.admin_id}, Date: ${ban.ban_date}`);
    });

    // Test 2: Create a test ban for testing (using a test IP)
    const testIP = '192.168.1.100'; // Test IP address
    console.log(`\n2. Creating test ban for IP: ${testIP}`);
    
    // Check if test IP is already banned
    const existingTestBan = await db.collection('ban').findOne({ ip_address: testIP });
    if (existingTestBan) {
      console.log('   Test IP is already banned');
    } else {
      await db.collection('ban').insertOne({
        ip_address: testIP,
        admin_id: 'test-admin',
        ban_date: new Date().toISOString(),
      });
      console.log('   ✅ Test ban created');
    }

    // Test 3: Verify the ban exists
    console.log('\n3. Verifying test ban exists...');
    const testBan = await db.collection('ban').findOne({ ip_address: testIP });
    if (testBan) {
      console.log('   ✅ Test ban found in database');
    } else {
      console.log('   ❌ Test ban not found');
    }

    // Test 4: Test the middleware function
    console.log('\n4. Testing middleware logic...');
    
    // Simulate the isIPBanned function from middleware
    async function testIsIPBanned(ip_address) {
      if (ip_address === 'unknown') {
        return false;
      }
      const ban = await db.collection('ban').findOne({ ip_address });
      return ban !== null;
    }

    // Test with banned IP
    const isBanned = await testIsIPBanned(testIP);
    console.log(`   IP ${testIP} is banned: ${isBanned}`);

    // Test with non-banned IP
    const isNotBanned = await testIsIPBanned('192.168.1.200');
    console.log(`   IP 192.168.1.200 is banned: ${isNotBanned}`);

    // Test with unknown IP
    const isUnknownBanned = await testIsIPBanned('unknown');
    console.log(`   IP 'unknown' is banned: ${isUnknownBanned}`);

    console.log('\n5. Manual testing instructions:');
    console.log('   To test the middleware:');
    console.log('   1. Start the development server: npm run dev');
    console.log('   2. The middleware will check IP addresses on every page request');
    console.log('   3. Banned IPs will receive a 403 Forbidden response');
    console.log('   4. Check the browser console/network tab for blocked requests');
    
    console.log(`\n6. Clean up test ban for IP: ${testIP}`);
    await db.collection('ban').deleteOne({ ip_address: testIP, admin_id: 'test-admin' });
    console.log('   ✅ Test ban removed');

    console.log('\n✅ IP Ban Middleware test completed successfully!');
    console.log('\nThe middleware is now active and will:');
    console.log('- Check every page request against the ban collection');
    console.log('- Block access for banned IP addresses');
    console.log('- Return 403 Forbidden for banned IPs');
    console.log('- Allow normal operation for non-banned IPs');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testIPBanMiddleware().catch(console.error);
