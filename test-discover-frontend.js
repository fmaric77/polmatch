const fetch = require('node-fetch');

async function testDiscoverAPI() {
  try {
    console.log('Testing discover groups API endpoint...');
    
    // Test the API endpoint directly
    const response = await fetch('http://localhost:3000/api/groups/discover?page=1&limit=20');
    const data = await response.json();
    
    console.log('API Response Status:', response.status);
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log(`Found ${data.groups.length} groups`);
      console.log('Pagination:', data.pagination);
    } else {
      console.log('API Error:', data.error);
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testDiscoverAPI();
