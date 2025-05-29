const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000';

async function testInvitationsWithAuth() {
  console.log('🧪 Testing group invitations system with proper authentication...\n');
  
  try {
    // Step 1: Login to get session cookie
    console.log('1. Logging in as sokol@example.com...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('   Login response:', loginData);
    
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.message);
      return;
    }
    
    // Extract session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    const sessionMatch = cookies?.match(/session=([^;]+)/);
    const sessionCookie = sessionMatch ? `session=${sessionMatch[1]}` : null;
    
    if (!sessionCookie) {
      console.error('❌ No session cookie received');
      return;
    }
    
    console.log('   ✅ Login successful, got session cookie\n');
    
    // Step 2: Test fetching invitations
    console.log('2. Testing fetch invitations...');
    const invitationsResponse = await fetch(`${BASE_URL}/api/invitations`, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      }
    });
    
    const invitationsData = await invitationsResponse.json();
    console.log('   Invitations response:', invitationsData);
    
    if (invitationsData.success) {
      console.log(`   ✅ Found ${invitationsData.invitations.length} pending invitations\n`);
    } else {
      console.log('   ⚠️ No invitations or error:', invitationsData.message, '\n');
    }
    
    // Step 3: Test creating a group to invite to (if no groups exist)
    console.log('3. Testing create group for invitation testing...');
    const createGroupResponse = await fetch(`${BASE_URL}/api/groups`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Invitation Group',
        description: 'Group for testing invitations',
        topic: 'testing',
        is_private: false
      })
    });
    
    const createGroupData = await createGroupResponse.json();
    console.log('   Create group response:', createGroupData);
    
    if (createGroupData.success) {
      console.log('   ✅ Test group created successfully\n');
      
      const testGroupId = createGroupData.group_id;
      
      // Step 4: Test sending invitation to a different user
      console.log('4. Testing send invitation...');
      
      // First, check if we have any users to invite to
      const usersResponse = await fetch(`${BASE_URL}/api/users`, {
        method: 'GET',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/json'
        }
      });
      
      const usersData = await usersResponse.json();
      console.log('   Available users:', usersData);
      
      if (usersData.success && usersData.users && usersData.users.length > 1) {
        // Find a user that's not the current user
        const currentUserId = loginData.user.user_id;
        const targetUser = usersData.users.find(user => user.user_id !== currentUserId);
        
        if (targetUser) {
          console.log(`   Found target user: ${targetUser.username} (${targetUser.user_id})`);
          
          const inviteResponse = await fetch(`${BASE_URL}/api/groups/${testGroupId}/invite`, {
            method: 'POST',
            headers: {
              'Cookie': sessionCookie,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              invited_user_id: targetUser.user_id
            })
          });
          
          const inviteData = await inviteResponse.json();
          console.log('   Invite response:', inviteData);
          
          if (inviteData.success) {
            console.log('   ✅ Invitation sent successfully\n');
            
            // Step 5: Test responding to invitation (would need to login as target user)
            console.log('5. Note: To test invitation response, would need to login as target user');
            console.log(`   Target user: ${targetUser.username}`);
            console.log(`   Invitation ID: ${inviteData.invitation_id}\n`);
            
          } else {
            console.log('   ❌ Failed to send invitation:', inviteData.message, '\n');
          }
        } else {
          console.log('   ⚠️ No other users found to invite\n');
        }
      } else {
        console.log('   ⚠️ Could not fetch users for invitation testing\n');
      }
      
    } else {
      console.log('   ❌ Failed to create test group:', createGroupData.message, '\n');
    }
    
    console.log('✅ Invitation system test completed');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testInvitationsWithAuth();
