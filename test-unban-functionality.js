// Test script to check unban functionality
const puppeteer = require('puppeteer');

async function testUnbanFunctionality() {
  console.log('Starting unban functionality test...');
  
  try {
    const browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Listen for console logs from the page
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`[BROWSER ERROR]: ${error.message}`);
    });
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    console.log('Logging in...');
    
    // Login
    await page.type('input[type="email"]', 'sokol@example.com');
    await page.type('input[type="password"]', 'mango');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(3000);
    
    console.log('Navigating to groups...');
    
    // Navigate to groups section
    const groupsCategoryButton = await page.$('[title="Groups"]');
    if (groupsCategoryButton) {
      await groupsCategoryButton.click();
      await page.waitForTimeout(2000);
      
      // Look for a group to join
      const firstGroup = await page.$('.cursor-pointer[data-conversation-type="group"]');
      if (firstGroup) {
        await firstGroup.click();
        await page.waitForTimeout(2000);
        
        console.log('Checking for banned users button...');
        
        // Look for banned users button
        const bannedUsersButton = await page.$('[title="Banned Users"]');
        if (bannedUsersButton) {
          console.log('Found banned users button, clicking...');
          await bannedUsersButton.click();
          await page.waitForTimeout(2000);
          
          // Check if modal opened
          const modal = await page.$('.fixed.inset-0.bg-black.bg-opacity-50');
          if (modal) {
            console.log('Banned users modal opened successfully');
            
            // Check for unban buttons
            const unbanButtons = await page.$$('[title="Unban User"]');
            console.log(`Found ${unbanButtons.length} unban buttons`);
            
            if (unbanButtons.length > 0) {
              console.log('Clicking first unban button...');
              await unbanButtons[0].click();
              await page.waitForTimeout(1000);
              
              // Check for confirmation dialog
              page.on('dialog', async dialog => {
                console.log(`Dialog appeared: ${dialog.message()}`);
                await dialog.accept();
              });
              
              await page.waitForTimeout(3000);
            } else {
              console.log('No banned users to unban');
            }
          } else {
            console.log('Banned users modal did not open');
          }
        } else {
          console.log('Banned users button not found - user might not have admin privileges');
        }
      } else {
        console.log('No groups found');
      }
    } else {
      console.log('Groups category button not found');
    }
    
    // Keep the browser open for manual inspection
    console.log('Test completed. Browser will remain open for manual inspection...');
    await page.waitForTimeout(30000);
    
    await browser.close();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUnbanFunctionality();
