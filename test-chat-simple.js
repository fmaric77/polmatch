// Simple test with cookie handling
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    slowMo: 100 // Add slow motion to see what's happening
  });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  try {
    console.log('🔗 Going to login page...');
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load and input to be available
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    
    console.log('📝 Filling login form...');
    await page.type('input[type="text"]', 'sokol@example.com');
    await page.type('input[type="password"]', 'mango');
    
    console.log('🔑 Submitting login...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('✅ Login successful, redirected to:', page.url());
    
    console.log('💬 Navigating to chat...');
    await page.goto('http://localhost:3000/chat');
    
    // Wait for chat to load
    await page.waitForSelector('[class*="UnifiedMessages"], .UnifiedMessages, [data-testid="unified-messages"]', { timeout: 15000 });
    console.log('✅ Chat page loaded');
    
    // Wait for conversations to load
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for conversations and messages...');
    
    // Try to find conversation elements
    const conversations = await page.$$eval('[class*="conversation"], [class*="chat"]', elements => 
      elements.length
    ).catch(() => 0);
    
    console.log(`Found ${conversations} conversation elements`);
    
    // Try to find message elements
    const messages = await page.$$eval('[class*="message"], [class*="msg"]', elements => 
      elements.length
    ).catch(() => 0);
    
    console.log(`Found ${messages} message elements`);
    
    // Wait longer to see console output
    console.log('⏱️ Waiting to observe debug logs...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
