// Test script to login and then check discovery
// This should be run in the browser console

async function testLoginAndDiscovery() {
  console.log('Testing login and discovery...');
  
  try {
    // First, try to login
    console.log('Attempting login...');
    const loginResponse = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.success) {
      console.log('Login successful! Now testing discovery...');
      
      // Wait a moment for session to be set
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test discovery endpoint
      const discoveryResponse = await fetch('/api/groups/discover?page=1&limit=20');
      const discoveryData = await discoveryResponse.json();
      
      console.log('Discovery response:', discoveryData);
      
      if (discoveryData.success) {
        console.log(`Found ${discoveryData.groups.length} groups`);
        console.log('Groups:', discoveryData.groups);
      } else {
        console.log('Discovery failed:', discoveryData.error);
      }
      
    } else {
      console.log('Login failed:', loginData.error);
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testLoginAndDiscovery();
