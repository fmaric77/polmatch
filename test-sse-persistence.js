const puppeteer = require('puppeteer');

async function testSSEPersistence() {
  console.log('🧪 Starting SSE persistence test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const pages = await Promise.all([
    browser.newPage(),
    browser.newPage()
  ]);
  
  const [page1, page2] = pages;
  
  // Setup logging for both pages
  page1.on('console', msg => console.log('📱 Page1:', msg.text()));
  page2.on('console', msg => console.log('📱 Page2:', msg.text()));
  
  try {
    console.log('🔐 Logging in both users...');
    
    // Login user 1 (sokol)
    await page1.goto('http://localhost:3000/login');
    await page1.waitForSelector('input[type="email"]');
    await page1.type('input[type="email"]', 'sokol@example.com');
    await page1.type('input[type="password"]', 'mango');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation();
    
    // Login user 2 (s)
    await page2.goto('http://localhost:3000/login');
    await page2.waitForSelector('input[type="email"]');
    await page2.type('input[type="email"]', 's@example.com');
    await page2.type('input[type="password"]', 'mango');
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation();
    
    console.log('✅ Both users logged in');
    
    // Wait for SSE connections to establish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check SSE connection status
    const sseStatus1 = await page1.evaluate(() => {
      return {
        connected: window.__sseConnected || false,
        hasVoiceCall: !!document.querySelector('[data-testid="voice-call"]')
      };
    });
    
    const sseStatus2 = await page2.evaluate(() => {
      return {
        connected: window.__sseConnected || false,
        hasVoiceCall: !!document.querySelector('[data-testid="voice-call"]')
      };
    });
    
    console.log('🔍 Initial SSE status:', { sseStatus1, sseStatus2 });
    
    // Navigate to conversation on page1
    await page1.click('[data-testid="conversation-alfred"]').catch(() => {
      console.log('⚠️ Could not find conversation button, trying alternative selector');
      return page1.click('.conversation-item:first-child');
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Initiate a call from page1
    console.log('📞 Starting call test...');
    await page1.click('[data-testid="call-button"]').catch(() => {
      console.log('⚠️ Could not find call button, trying alternative selector');
      return page1.click('button:has-text("Call")');
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if incoming call appears on page2
    const hasIncomingCall = await page2.evaluate(() => {
      return !!document.querySelector('[data-testid="incoming-call-modal"]');
    });
    
    console.log('📞 Incoming call detected on page2:', hasIncomingCall);
    
    if (hasIncomingCall) {
      // Accept the call
      await page2.click('[data-testid="accept-call"]');
      console.log('✅ Call accepted');
      
      // Wait for call to establish
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // End the call from page1
      await page1.click('[data-testid="end-call"]').catch(() => {
        console.log('⚠️ Could not find end call button');
      });
      
      console.log('🔚 Call ended');
    } else {
      // Cancel the call
      await page1.click('[data-testid="cancel-call"]').catch(() => {
        console.log('⚠️ Could not find cancel button');
      });
      console.log('❌ Call cancelled');
    }
    
    // Wait for call to fully end
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check SSE connection status after call
    const postCallStatus1 = await page1.evaluate(() => {
      return {
        connected: window.__sseConnected || false
      };
    });
    
    const postCallStatus2 = await page2.evaluate(() => {
      return {
        connected: window.__sseConnected || false
      };
    });
    
    console.log('🔍 Post-call SSE status:', { postCallStatus1, postCallStatus2 });
    
    // Try to make another call to test if notifications work
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📞 Testing second call...');
    await page1.click('[data-testid="call-button"]').catch(() => {
      console.log('⚠️ Could not find call button for second attempt');
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if second incoming call appears on page2
    const hasSecondIncomingCall = await page2.evaluate(() => {
      return !!document.querySelector('[data-testid="incoming-call-modal"]');
    });
    
    console.log('📞 Second incoming call detected on page2:', hasSecondIncomingCall);
    
    if (!hasSecondIncomingCall) {
      console.error('❌ ISSUE REPRODUCED: Second call not received!');
    } else {
      console.log('✅ Second call received successfully');
      // Cancel the second call
      await page1.click('[data-testid="cancel-call"]').catch(() => {
        console.log('⚠️ Could not find cancel button for second call');
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testSSEPersistence().catch(console.error);
