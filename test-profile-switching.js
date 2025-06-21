import fetch from 'node-fetch';

// Test profile type switching functionality
async function testProfileSwitching() {
  const baseUrl = 'http://localhost:3000';
  
  // Login first
  console.log('🔐 Logging in...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });
  
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('❌ Login failed:', loginData.message);
    return;
  }
  
  const sessionToken = loginData.token;
  console.log('✅ Login successful');
  
  // Test different profile types
  const profileTypes = ['basic', 'love', 'business'];
  
  for (const profileType of profileTypes) {
    console.log(`\n🔄 Testing profile type: ${profileType}`);
    
    try {
      // Test groups list endpoint
      const groupsRes = await fetch(`${baseUrl}/api/groups/list?profile_type=${profileType}`, {
        headers: {
          'Cookie': `session=${sessionToken}`
        }
      });
      
      const groupsData = await groupsRes.json();
      console.log(`📋 Groups for ${profileType}:`, groupsData.success ? `${groupsData.groups.length} groups` : groupsData.error);
      
      // Test invitations endpoint
      const invitationsRes = await fetch(`${baseUrl}/api/invitations?profile_type=${profileType}`, {
        headers: {
          'Cookie': `session=${sessionToken}`
        }
      });
      
      const invitationsData = await invitationsRes.json();
      console.log(`📬 Invitations for ${profileType}:`, invitationsData.success ? `${invitationsData.invitations.length} invitations` : invitationsData.error);
      
    } catch (error) {
      console.error(`❌ Error testing ${profileType}:`, error.message);
    }
  }
  
  console.log('\n✅ Profile switching test completed');
}

testProfileSwitching().catch(console.error);
