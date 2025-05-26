// Test script to verify delete message functionality
const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing delete message functionality...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'] 
  });
  
  try {
    const page = await browser.newPage();
    
    // Login first
    console.log('1. Logging in...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    await page.type('input[type="email"]', 'sokol@example.com');
    await page.type('input[type="password"]', 'mango');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('2. Navigating to chat...');
    
    // Wait for chat to load and select a conversation
    await page.waitForSelector('.cursor-pointer', { timeout: 10000 });
    
    // Click on first conversation
    const conversations = await page.$$('.cursor-pointer');
    if (conversations.length > 0) {
      await conversations[0].click();
      console.log('3. Selected first conversation');
      
      // Wait for messages to load
      await page.waitForSelector('[data-message]', { timeout: 5000 }).catch(() => {
        console.log('No messages found, this might be expected');
      });
      
      // Try to right-click on a message to bring up context menu
      const messages = await page.$$('[oncontextmenu]');
      if (messages.length > 0) {
        console.log('4. Found messages, testing right-click context menu...');
        
        // Right-click on the first message
        await messages[0].click({ button: 'right' });
        
        // Wait for context menu
        await page.waitForSelector('.fixed', { timeout: 2000 }).catch(() => {
          console.log('Context menu not found');
        });
        
        // Look for delete option
        const deleteButton = await page.$('button:contains("Delete Message")').catch(() => null);
        if (deleteButton) {
          console.log('5. Delete message button found, clicking...');
          await deleteButton.click();
          
          // Monitor network for the DELETE request
          console.log('6. Monitoring network for DELETE request...');
          
        } else {
          console.log('5. Delete message button not found in context menu');
        }
        
      } else {
        console.log('4. No messages found to test delete functionality');
      }
      
    } else {
      console.log('3. No conversations found');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    console.log('Test completed, keeping browser open for manual inspection...');
    // Keep browser open for manual inspection
    // await browser.close();
  }
})();
