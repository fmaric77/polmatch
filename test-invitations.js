const testInvitations = async () => {
  try {
    console.log('Testing group invitations system...');
    
    // Test 1: Check if invitations API is working
    console.log('\n=== Test 1: Fetching invitations ===');
    const invitationsRes = await fetch('http://localhost:3000/api/invitations', {
      method: 'GET',
      headers: {
        'Cookie': 'session=your_session_token_here'
      }
    });
    const invitationsData = await invitationsRes.json();
    console.log('Invitations response:', invitationsData);
    
    // Test 2: Check if invitation sending is working
    console.log('\n=== Test 2: Testing invitation sending ===');
    // This would need actual group and user IDs
    
    // Test 3: Check if response endpoint is working
    console.log('\n=== Test 3: Testing invitation response ===');
    // This would need an actual invitation ID
    
  } catch (error) {
    console.error('Test error:', error);
  }
};

// Run the test
if (typeof window !== 'undefined') {
  // Run in browser
  testInvitations();
} else {
  // Node.js environment
  const fetch = require('node-fetch');
  testInvitations();
}
