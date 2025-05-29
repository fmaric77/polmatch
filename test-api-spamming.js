const BASE_URL = 'http://localhost:3000';

async function testApiSpamming() {
  console.log('🔍 Testing API spamming issue...\n');

  // Step 1: Login first
  console.log('1. Logging in...');
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });

  const loginData = await loginResponse.json();
  if (!loginData.success) {
    console.error('❌ Login failed:', loginData.message);
    return;
  }

  console.log('✅ Login successful');
  
  // Extract session cookie
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  if (!setCookieHeader) {
    console.error('❌ No session cookie received');
    return;
  }
  
  const sessionCookie = setCookieHeader.split(';')[0];
  console.log('✅ Session cookie received');

  // Step 2: Monitor /api/users/available calls
  console.log('\n2. Monitoring /api/users/available calls...');
  
  let callCount = 0;
  const callTimes = [];
  
  async function makeTestCall() {
    const startTime = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/users/available`, {
        headers: { 'Cookie': sessionCookie }
      });
      const data = await response.json();
      callCount++;
      callTimes.push(startTime);
      
      console.log(`📞 Call #${callCount} - Status: ${response.status} - Success: ${data.success} - Users: ${data.users?.length || 0}`);
      
      // Calculate average interval between calls
      if (callTimes.length > 1) {
        const intervals = [];
        for (let i = 1; i < callTimes.length; i++) {
          intervals.push(callTimes[i] - callTimes[i-1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        console.log(`   Average interval between calls: ${avgInterval.toFixed(2)}ms`);
      }
      
    } catch (error) {
      console.error(`❌ Call #${callCount + 1} failed:`, error.message);
    }
  }

  // Make a few test calls to see baseline
  console.log('\nMaking 3 test calls with 1 second interval...');
  for (let i = 0; i < 3; i++) {
    await makeTestCall();
    if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n3. Test completed');
  console.log(`Total calls made: ${callCount}`);
  
  if (callTimes.length > 1) {
    const totalTime = callTimes[callTimes.length - 1] - callTimes[0];
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Call frequency: ${(callCount / (totalTime / 1000)).toFixed(2)} calls/second`);
  }
}

testApiSpamming().catch(console.error);
