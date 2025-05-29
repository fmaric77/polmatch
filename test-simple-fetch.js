console.log('Starting API monitoring test...');

async function testApi() {
  try {
    console.log('Testing fetch availability...');
    const response = await fetch('http://localhost:3000/api/session');
    console.log('Fetch works, status:', response.status);
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testApi();
