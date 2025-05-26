// Debug script to trace frontend message loading issues
console.log('🔍 Starting frontend debug trace...');

// Override fetch to log all API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 FETCH:', args[0], args[1] ? JSON.stringify(args[1]) : '');
  return originalFetch.apply(this, args).then(response => {
    console.log('📥 FETCH RESPONSE:', response.status, response.url);
    // Clone response to avoid consuming it
    const clonedResponse = response.clone();
    clonedResponse.json().then(data => {
      console.log('📊 FETCH DATA:', response.url, data);
    }).catch(() => {
      console.log('📊 FETCH DATA: (not JSON)', response.url);
    });
    return response;
  });
};

// Add state change logging for React
window.debugMessageState = {
  conversations: [],
  messages: [],
  selectedConversation: '',
  currentUser: null
};

// Log when state changes
const logStateChange = (key, value) => {
  console.log(`🔄 STATE CHANGE [${key}]:`, value);
  window.debugMessageState[key] = value;
};

// Monitor React state updates by patching useState (basic approach)
const originalConsoleLog = console.log;
window.logStateUpdate = (component, state, value) => {
  console.log(`🎯 [${component}] ${state}:`, value);
};

console.log('✅ Frontend debug trace initialized. Check browser console for detailed logs.');
