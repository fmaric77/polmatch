// Simple script to login and then navigate to chat
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  try {
    // Navigate to login
    await page.goto('http://localhost:3000');
    await page.waitForSelector('input[type="text"]');
    
    // Login
    await page.type('input[type="text"]', 'sokol@example.com');
    await page.type('input[type="password"]', 'mango');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForNavigation();
    console.log('Logged in successfully');
    
    // Navigate to chat
    await page.goto('http://localhost:3000/chat');
    await page.waitForSelector('.UnifiedMessages', { timeout: 10000 });
    
    console.log('Chat page loaded');
    
    // Wait to see logs
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
