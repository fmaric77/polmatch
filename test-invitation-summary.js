// Simple test to check invitation summary functionality
console.log('Testing invitation summary...');

// Test the invitation summary endpoint
fetch('http://localhost:3000/api/invitations/summary', {
  headers: {
    'Cookie': 'session=your-session-token-here'
  }
})
.then(res => res.json())
.then(data => {
  console.log('Invitation Summary:', data);
})
.catch(err => {
  console.error('Error:', err);
});

// Test individual profile types
const profileTypes = ['basic', 'love', 'business'];
profileTypes.forEach(profileType => {
  fetch(`http://localhost:3000/api/invitations?profile_type=${profileType}`, {
    headers: {
      'Cookie': 'session=your-session-token-here'
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log(`${profileType} invitations:`, data);
  })
  .catch(err => {
    console.error(`Error fetching ${profileType} invitations:`, err);
  });
});
