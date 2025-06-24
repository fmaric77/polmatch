// Script to help diagnose and fix CSRF token issues for 2FA setup

console.log('🔧 CSRF Token Diagnostic & Fix Script');
console.log('====================================\n');

// Step 1: Clear any cached CSRF tokens
console.log('1. Clearing cached CSRF tokens...');
if (typeof window !== 'undefined') {
  // Client-side: Clear CSRF token cache
  localStorage.removeItem('csrfToken');
  sessionStorage.removeItem('csrfToken');
  
  // Clear any service worker cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
  
  console.log('✅ Client-side caches cleared');
}

// Step 2: Test CSRF token flow
async function testCSRFFlow() {
  try {
    console.log('\n2. Testing CSRF token flow...');
    
    // Clear any existing CSRF token from the client
    const csrfModule = await import('./lib/csrf-client.js');
    csrfModule.clearCSRFToken();
    
    console.log('📡 Step 2a: Fetching fresh CSRF token...');
    const tokenResponse = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache'
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`CSRF token fetch failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }
    
    const tokenData = await tokenResponse.json();
    console.log('✅ CSRF token obtained:', tokenData.csrfToken.substring(0, 16) + '...');
    
    console.log('🔐 Step 2b: Testing 2FA setup with token...');
    const setupResponse = await fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': tokenData.csrfToken,
        'Cache-Control': 'no-cache'
      },
      credentials: 'include',
      cache: 'no-cache'
    });
    
    const setupData = await setupResponse.json();
    
    console.log('📊 Response Status:', setupResponse.status);
    console.log('📊 Response Data:', setupData);
    
    if (setupResponse.ok && setupData.success) {
      console.log('✅ SUCCESS: 2FA setup worked! CSRF token is functioning correctly.');
      return true;
    } else if (setupResponse.status === 403) {
      console.log('❌ CSRF validation still failing. Let\'s try alternative approaches...');
      return false;
    } else {
      console.log('⚠️ Unexpected response. Check server logs for details.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error during CSRF flow test:', error);
    return false;
  }
}

// Step 3: Alternative fix - use direct token approach
async function alternativeFix() {
  console.log('\n3. Trying alternative CSRF approach...');
  
  try {
    // Get session info first
    const sessionResponse = await fetch('/api/session', {
      credentials: 'include',
      cache: 'no-cache'
    });
    
    if (!sessionResponse.ok) {
      throw new Error('No valid session found. Please log in first.');
    }
    
    const sessionData = await sessionResponse.json();
    console.log('✅ Valid session found for user:', sessionData.user?.username || 'unknown');
    
    // Try a different approach - multiple token requests
    console.log('🔄 Trying multiple token generation approach...');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`Attempt ${i}/3:`);
      
      const tokenResp = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (tokenResp.ok) {
        const { csrfToken } = await tokenResp.json();
        
        const setupResp = await fetch('/api/auth/2fa/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            'Cache-Control': 'no-cache'
          },
          credentials: 'include',
          cache: 'no-cache'
        });
        
        if (setupResp.ok) {
          const result = await setupResp.json();
          if (result.success) {
            console.log(`✅ SUCCESS on attempt ${i}!`);
            return true;
          }
        } else if (setupResp.status === 403) {
          console.log(`❌ Attempt ${i} failed with CSRF error`);
        }
      }
      
      // Wait a bit between attempts
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Alternative fix failed:', error);
    return false;
  }
}

// Step 4: Manual browser instructions
function showManualInstructions() {
  console.log('\n4. Manual Browser Fix Instructions');
  console.log('==================================');
  console.log('If the automated fixes don\'t work, try these manual steps:');
  console.log('');
  console.log('📋 Browser Steps:');
  console.log('1. Open Developer Tools (F12)');
  console.log('2. Go to Application/Storage tab');
  console.log('3. Clear all cookies for this domain');
  console.log('4. Clear Local Storage');
  console.log('5. Clear Session Storage');
  console.log('6. Hard refresh the page (Ctrl+Shift+R)');
  console.log('7. Log in again');
  console.log('8. Try 2FA setup again');
  console.log('');
  console.log('📋 Alternative - Private/Incognito Window:');
  console.log('1. Open a new private/incognito window');
  console.log('2. Navigate to your site');
  console.log('3. Log in fresh');
  console.log('4. Try 2FA setup');
  console.log('');
  console.log('📋 Server-side Check:');
  console.log('1. Check server console for CSRF debug messages');
  console.log('2. Look for session mismatch warnings');
  console.log('3. Restart the server if needed');
}

// Main execution
async function main() {
  let success = false;
  
  // Test 1: Standard CSRF flow
  success = await testCSRFFlow();
  
  if (!success) {
    // Test 2: Alternative approach
    success = await alternativeFix();
  }
  
  if (!success) {
    // Show manual instructions
    showManualInstructions();
    
    console.log('\n🔍 Next Steps:');
    console.log('1. Check the browser console for any error messages');
    console.log('2. Check the server console for CSRF debug messages');
    console.log('3. Try the manual browser steps above');
    console.log('4. If still failing, check if multiple tabs are open (session conflicts)');
  } else {
    console.log('\n🎉 CSRF token issue has been resolved!');
    console.log('You can now use 2FA setup normally.');
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.fixCSRF = main;
  console.log('💡 Run window.fixCSRF() in browser console to execute this fix');
} else {
  // Node.js environment
  console.log('💡 This script is designed to run in the browser console');
  console.log('Copy and paste the entire script into your browser\'s developer console');
}

// Instructions for usage
console.log('\n📋 How to use this script:');
console.log('1. Open your browser developer console (F12)');
console.log('2. Copy and paste this entire script');
console.log('3. Press Enter to load it');
console.log('4. Run: window.fixCSRF()');
console.log('5. Follow the instructions that appear'); 