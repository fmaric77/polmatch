const puppeteer = require('puppeteer');

async function testVoiceCallSystem() {
  console.log('🎯 Starting Voice Call System End-to-End Test...');
  
  let browser1, browser2;
  let page1, page2;
  
  try {
    // Launch two browser instances to simulate caller and recipient
    browser1 = await puppeteer.launch({ 
      headless: false, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    browser2 = await puppeteer.launch({ 
      headless: false, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
    
    // Set console logging
    page1.on('console', msg => console.log(`👤 Caller (Page1):`, msg.text()));
    page2.on('console', msg => console.log(`👥 Recipient (Page2):`, msg.text()));
    
    // Login as caller (sokol@example.com)
    console.log('📋 Step 1: Logging in caller...');
    await page1.goto('http://localhost:3000/login');
    await page1.waitForSelector('input[type="email"]');
    await page1.type('input[type="email"]', 'sokol@example.com');
    await page1.type('input[type="password"]', 'mango');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('✅ Caller logged in successfully');
    
    // Login as recipient (we need another user)
    console.log('📋 Step 2: Logging in recipient...');
    // For now, let's create a dummy test user or use existing user
    await page2.goto('http://localhost:3000/login');
    await page2.waitForSelector('input[type="email"]');
    // We'll use another test email, let's first check what users exist
    
    console.log('📋 Step 3: Checking available users for testing...');
    
    // Test API endpoints first
    console.log('📋 Step 4: Testing Agora token generation...');
    const tokenResponse = await page1.evaluate(async () => {
      try {
        const response = await fetch('/api/agora/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelName: 'test-channel-123',
            uid: 'test-uid-123'
          })
        });
        const data = await response.json();
        return { success: response.ok, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    if (tokenResponse.success) {
      console.log('✅ Agora token generation working');
      console.log('📋 Token data:', tokenResponse.data);
    } else {
      console.log('❌ Agora token generation failed:', tokenResponse.error);
    }
    
    // Test voice call API endpoint
    console.log('📋 Step 5: Testing voice call API...');
    const callResponse = await page1.evaluate(async () => {
      try {
        const response = await fetch('/api/voice-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_id: 'test-recipient-123',
            channel_name: 'test-channel-456',
            call_type: 'voice'
          })
        });
        const data = await response.json();
        return { success: response.ok, data, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📋 Voice call API response:', callResponse);
    
    // Test SSE connection
    console.log('📋 Step 6: Testing SSE connection...');
    await page1.evaluate(() => {
      if (typeof EventSource !== 'undefined') {
        const eventSource = new EventSource('/api/sse');
        eventSource.onopen = () => {
          console.log('✅ SSE connection opened');
        };
        eventSource.onmessage = (event) => {
          console.log('📨 SSE message:', event.data);
        };
        eventSource.onerror = (error) => {
          console.log('❌ SSE error:', error);
        };
        // Store for later cleanup
        window.testEventSource = eventSource;
      } else {
        console.log('❌ EventSource not supported');
      }
    });
    
    // Wait a bit for SSE to connect
    await page1.waitForTimeout(2000);
    
    console.log('📋 Step 7: Checking UI elements...');
    
    // Check if voice call button exists
    const voiceCallButtonExists = await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(button => 
        button.textContent?.includes('📞') || 
        button.querySelector('[data-icon="phone"]') ||
        button.innerHTML.includes('fa-phone')
      );
    });
    
    console.log('📞 Voice call button exists:', voiceCallButtonExists);
    
    // Check if we can find the UnifiedMessagesRefactored component
    const unifiedMessagesExists = await page1.evaluate(() => {
      return document.querySelector('[data-testid="unified-messages"]') !== null ||
             document.querySelector('.unified-messages') !== null ||
             document.body.innerHTML.includes('UnifiedMessages');
    });
    
    console.log('📱 UnifiedMessages component exists:', unifiedMessagesExists);
    
    // Test voice call flow simulation
    console.log('📋 Step 8: Simulating voice call initiation...');
    
    const voiceCallSimulation = await page1.evaluate(async () => {
      try {
        // Check if VoiceCall component is available
        const voiceCallExists = window.React && 
          document.body.innerHTML.includes('VoiceCall');
        
        if (!voiceCallExists) {
          return { success: false, error: 'VoiceCall component not found' };
        }
        
        // Try to trigger a voice call (this would normally be done via UI)
        const response = await fetch('/api/voice-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_id: 'test-user-456',
            channel_name: 'test-channel-789',
            call_type: 'voice'
          })
        });
        
        const data = await response.json();
        return { 
          success: response.ok, 
          data,
          voiceCallExists,
          status: response.status 
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📞 Voice call simulation result:', voiceCallSimulation);
    
    // Test component rendering
    console.log('📋 Step 9: Testing component rendering...');
    const componentTest = await page1.evaluate(() => {
      const components = {
        chatArea: document.body.innerHTML.includes('ChatArea'),
        voiceCall: document.body.innerHTML.includes('VoiceCall'),
        sseNotifications: document.body.innerHTML.includes('sse') || 
                         document.body.innerHTML.includes('EventSource'),
        agoraElements: document.body.innerHTML.includes('agora') ||
                      document.body.innerHTML.includes('Agora')
      };
      
      return components;
    });
    
    console.log('🧩 Component presence:', componentTest);
    
    console.log('📋 Step 10: Final system health check...');
    
    // Check if all required dependencies are loaded
    const dependencyCheck = await page1.evaluate(() => {
      return {
        react: typeof React !== 'undefined',
        nextjs: typeof __NEXT_DATA__ !== 'undefined',
        agora: typeof AgoraRTC !== 'undefined',
        eventSource: typeof EventSource !== 'undefined'
      };
    });
    
    console.log('📦 Dependencies check:', dependencyCheck);
    
    // Cleanup SSE connection
    await page1.evaluate(() => {
      if (window.testEventSource) {
        window.testEventSource.close();
        console.log('🧹 SSE connection cleaned up');
      }
    });
    
    console.log('✅ Voice Call System Test Completed!');
    console.log('📊 Summary:');
    console.log('  - Agora token generation:', tokenResponse.success ? '✅' : '❌');
    console.log('  - Voice call API:', callResponse.success ? '✅' : '❌');
    console.log('  - Voice call button:', voiceCallButtonExists ? '✅' : '❌');
    console.log('  - UnifiedMessages:', unifiedMessagesExists ? '✅' : '❌');
    console.log('  - Dependencies:', Object.values(dependencyCheck).every(Boolean) ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }
}

// Run the test
testVoiceCallSystem().catch(console.error);
