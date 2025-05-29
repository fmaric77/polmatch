// Simple test for invitations using built-in Node.js fetch
async function testInvitations() {
  console.log('🧪 Testing group invitations system...\n');
  
  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login result:', loginData.success ? '✅ Success' : '❌ Failed');
    
    if (!loginData.success) {
      console.log('Error:', loginData.message);
      return;
    }
    
    // Get session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    const sessionMatch = cookies?.match(/session=([^;]+)/);
    const sessionCookie = sessionMatch ? `session=${sessionMatch[1]}` : null;
    
    if (!sessionCookie) {
      console.log('❌ No session cookie');
      return;
    }
    
    console.log('✅ Got session cookie\n');
    
    // Step 2: Test invitations API
    console.log('2. Testing invitations API...');
    const invitationsResponse = await fetch('http://localhost:3000/api/invitations', {
      headers: { 'Cookie': sessionCookie }
    });
    
    const invitationsData = await invitationsResponse.json();
    console.log('Invitations result:', invitationsData.success ? '✅ Success' : '❌ Failed');
    
    if (invitationsData.success) {
      console.log(`Found ${invitationsData.invitations.length} invitations`);
      invitationsData.invitations.forEach(inv => {
        console.log(`- ${inv.group_name} from ${inv.inviter_username}`);
      });
    } else {
      console.log('Error:', invitationsData.message);
    }
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvitations();
