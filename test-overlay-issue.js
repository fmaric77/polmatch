/**
 * Test script to debug the overlay issue in private messages
 */

const puppeteer = require('puppeteer');

async function testOverlayIssue() {
  let browser;
  
  try {
    console.log('Starting browser test for overlay issue...');
    
    browser = await puppeteer.launch({ 
      headless: false, // So we can see what's happening
      devtools: true
    });
    
    const page = await browser.newPage();
    
    // Listen to console logs from the page
    page.on('console', (msg) => {
      if (msg.text().includes('contextSwitchLoading') || 
          msg.text().includes('OVERLAY') || 
          msg.text().includes('🟡') || 
          msg.text().includes('🟢') ||
          msg.text().includes('🔵') ||
          msg.text().includes('🔴')) {
        console.log(`BROWSER: ${msg.text()}`);
      }
    });
    
    console.log('Navigating to app...');
    await page.goto('http://localhost:3001');
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    console.log('Looking for login form...');
    
    // Try to find login elements
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (emailInput && passwordInput) {
      console.log('Found login form, attempting login...');
      
      await page.type('input[type="email"]', 'sokol@example.com');
      await page.type('input[type="password"]', 'mango');
      
      // Look for login button and click it
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
        console.log('Clicked login button');
        
        // Wait for navigation/login to complete
        await page.waitForTimeout(3000);
        
        console.log('Login completed, now testing private message overlay issue...');
        
        // Look for private message conversations
        await page.waitForTimeout(2000);
        
        // Try to click on different conversations and watch for overlay issues
        const conversations = await page.$$('[data-testid="conversation"], .conversation-item, .cursor-pointer');
        
        if (conversations.length > 0) {
          console.log(`Found ${conversations.length} potential conversation elements`);
          
          for (let i = 0; i < Math.min(3, conversations.length); i++) {
            console.log(`Clicking on conversation ${i + 1}...`);
            await conversations[i].click();
            await page.waitForTimeout(1000);
            
            // Check if overlay is visible
            const overlay = await page.$('.absolute.inset-0.bg-black.backdrop-blur-sm');
            if (overlay) {
              console.log(`⚠️ OVERLAY DETECTED on conversation ${i + 1}!`);
            } else {
              console.log(`✅ No overlay on conversation ${i + 1}`);
            }
          }
        } else {
          console.log('No conversations found to test');
        }
        
        // Keep the browser open for manual testing
        console.log('Test completed. Browser will stay open for manual testing. Press Ctrl+C to close.');
        await page.waitForTimeout(60000); // Wait 1 minute
        
      } else {
        console.log('Login button not found');
      }
    } else {
      console.log('Login form not found');
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if we have puppeteer
try {
  require('puppeteer');
  testOverlayIssue();
} catch (e) {
  console.log('Puppeteer not available. Install with: npm install puppeteer');
  console.log('For now, please test manually at http://localhost:3001');
  console.log('1. Login with sokol@example.com / mango');
  console.log('2. Try switching between private message conversations');
  console.log('3. Watch the browser console for debug messages');
  console.log('4. Look for any overlay appearing over messages');
}
