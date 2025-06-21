// Simple test to navigate to groups with different profile types
// Open browser console and paste this to test the URL parameters

console.log('🧪 Testing profile switching in groups');

// Test navigating to groups with different profile types
const profileTypes = ['basic', 'love', 'business'];

profileTypes.forEach((profileType, index) => {
  setTimeout(() => {
    const url = `/chat?category=groups&profile=${profileType}`;
    console.log(`🔄 Testing URL: ${url}`);
    // In a real test, you would navigate to this URL
    // window.location.href = url;
  }, index * 1000);
});
