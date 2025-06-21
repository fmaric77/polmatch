// Test profile-specific display names in groups
// This script tests that group messages show the correct display names based on profile type

const testProfileDisplayNames = async () => {
  const baseUrl = 'http://localhost:3000';
  
  // Test login
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
  
  // Test different profile types for groups
  const profileTypes = ['basic', 'love', 'business'];
  
  for (const profileType of profileTypes) {
    console.log(`\n🔍 Testing ${profileType} profile display names in groups`);
    
    try {
      // Get groups for this profile type
      const groupsRes = await fetch(`${baseUrl}/api/groups/list?profile_type=${profileType}`, {
        headers: { 'Cookie': `session=${sessionToken}` }
      });
      
      const groupsData = await groupsRes.json();
      if (!groupsData.success) {
        console.log(`❌ Failed to get groups for ${profileType}:`, groupsData.error);
        continue;
      }
      
      console.log(`📋 Found ${groupsData.groups.length} groups for ${profileType}`);
      
      if (groupsData.groups.length > 0) {
        const firstGroup = groupsData.groups[0];
        console.log(`🏢 Testing group: ${firstGroup.name} (ID: ${firstGroup.group_id})`);
        
        // Get group members
        const membersRes = await fetch(`${baseUrl}/api/groups/${firstGroup.group_id}/members?profile_type=${profileType}`, {
          headers: { 'Cookie': `session=${sessionToken}` }
        });
        
        const membersData = await membersRes.json();
        if (membersData.success) {
          console.log(`👥 Members (${membersData.members.length}):`);
          membersData.members.forEach(member => {
            console.log(`  - ${member.display_name || member.username} (${member.username}) [${member.role}]`);
          });
        }
        
        // Get group messages if there's a default channel
        try {
          const messagesRes = await fetch(`${baseUrl}/api/groups/${firstGroup.group_id}/messages?profile_type=${profileType}&channel_id=general`, {
            headers: { 'Cookie': `session=${sessionToken}` }
          });
          
          const messagesData = await messagesRes.json();
          if (messagesData.success && messagesData.messages.length > 0) {
            console.log(`💬 Recent messages (${messagesData.messages.length}):`);
            messagesData.messages.slice(-3).forEach(msg => {
              const displayName = msg.sender_display_name || msg.sender_username;
              console.log(`  - ${displayName}: ${msg.content.substring(0, 50)}...`);
            });
          } else {
            console.log(`💬 No messages found`);
          }
        } catch (error) {
          console.log(`💬 Could not fetch messages: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${profileType}:`, error.message);
    }
  }
  
  console.log('\n✅ Profile display names test completed');
};

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testProfileDisplayNames };
}

// For browser usage
if (typeof window !== 'undefined') {
  window.testProfileDisplayNames = testProfileDisplayNames;
}
