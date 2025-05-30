// Test script to verify IP ban functionality
async function testIPBanFunctionality() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 Testing IP Ban Functionality');
  console.log('================================\n');
  
  try {
    // Test 1: Try to access the main page
    console.log('1. Testing main page access...');
    const pageResponse = await fetch(`${BASE_URL}/`, {
      method: 'GET',
      headers: {
        'x-forwarded-for': '188.252.221.33', // Simulating the banned IP
      }
    });
    
    console.log(`Page access status: ${pageResponse.status}`);
    if (pageResponse.status === 403) {
      const data = await pageResponse.json();
      console.log('✅ Page access correctly blocked:', data.message);
    } else {
      console.log('❌ Page access was not blocked (unexpected)');
    }
    
    // Test 2: Try to access the login API
    console.log('\n2. Testing login API access...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '188.252.221.33', // Simulating the banned IP
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    console.log(`Login API status: ${loginResponse.status}`);
    if (loginResponse.status === 403) {
      const data = await loginResponse.json();
      console.log('✅ Login API correctly blocked:', data.message);
    } else {
      console.log('❌ Login API was not blocked (unexpected)');
      const data = await loginResponse.json();
      console.log('Response:', data);
    }
    
    // Test 3: Test with a non-banned IP
    console.log('\n3. Testing with non-banned IP...');
    const cleanResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.100', // Different IP
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    console.log(`Clean IP login status: ${cleanResponse.status}`);
    if (cleanResponse.status === 200) {
      console.log('✅ Non-banned IP can access login API');
    } else {
      console.log('⚠️  Non-banned IP got status:', cleanResponse.status);
    }
    
    console.log('\n📊 Test Summary:');
    console.log('- Banned IP page access: ' + (pageResponse.status === 403 ? '✅ BLOCKED' : '❌ ALLOWED'));
    console.log('- Banned IP login API: ' + (loginResponse.status === 403 ? '✅ BLOCKED' : '❌ ALLOWED'));
    console.log('- Clean IP access: ' + (cleanResponse.status === 200 ? '✅ ALLOWED' : '❌ BLOCKED'));
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testIPBanFunctionality().catch(console.error);
