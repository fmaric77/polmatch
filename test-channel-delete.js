// Test script to debug group channel message deletion
const login = async () => {
  const response = await fetch('http://localhost:3001/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });
  
  const data = await response.json();
  const sessionCookie = response.headers.get('set-cookie');
  console.log('Login response:', data);
  console.log('Session cookie:', sessionCookie);
  
  return sessionCookie;
};

const testChannelEndpoint = async (sessionCookie) => {
  const groupId = '544f9653-ef43-48ee-9d82-cef684643d7d';
  const channelId = '6113ca22-75b4-4ee3-988e-288d056bb1e5';
  
  // First, let's try to get messages to see if the endpoint exists
  console.log('Testing GET endpoint...');
  const getResponse = await fetch(`http://localhost:3001/api/groups/${groupId}/channels/${channelId}/messages`, {
    method: 'GET',
    headers: {
      'Cookie': sessionCookie
    }
  });
  
  console.log('GET response status:', getResponse.status);
  const getData = await getResponse.json();
  console.log('GET response data:', getData);
  
  // If we have messages, try to delete one
  if (getData.messages && getData.messages.length > 0) {
    const messageId = getData.messages[0].message_id;
    console.log('\nTesting DELETE endpoint with message_id:', messageId);
    
    const deleteResponse = await fetch(`http://localhost:3001/api/groups/${groupId}/channels/${channelId}/messages`, {
      method: 'DELETE',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message_id: messageId })
    });
    
    console.log('DELETE response status:', deleteResponse.status);
    const deleteData = await deleteResponse.json();
    console.log('DELETE response data:', deleteData);
  } else {
    console.log('No messages found to delete');
  }
};

// Run the test
login().then(sessionCookie => {
  if (sessionCookie) {
    return testChannelEndpoint(sessionCookie);
  } else {
    console.log('Login failed');
  }
}).catch(console.error);
