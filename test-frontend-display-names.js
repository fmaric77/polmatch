const puppeteer = require('puppeteer');

async function testFrontendDisplayNames() {
  console.log('🎭 Testing frontend display names...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the app
    console.log('🔗 Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Login
    console.log('🔐 Logging in...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'sokol@example.com');
    await page.type('input[type="password"]', 'mango');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    console.log('⏳ Waiting for dashboard...');
    await page.waitForSelector('.dashboard', { timeout: 15000 });
    
    // Look for group conversations in the sidebar
    console.log('👥 Looking for group conversations...');
    await page.waitForTimeout(2000); // Let the page settle
    
    // Try to find and click on a group conversation
    const groupButtons = await page.$$('button[data-testid^="conversation-group-"]');
    if (groupButtons.length === 0) {
      console.log('❌ No group conversations found in sidebar');
      return;
    }
    
    console.log(`📋 Found ${groupButtons.length} group conversations`);
    
    // Click on the first group
    await groupButtons[0].click();
    console.log('✅ Clicked on first group');
    
    // Wait for messages to load
    await page.waitForTimeout(3000);
    
    // Look for message display names
    console.log('🔍 Looking for message display names...');
    const displayNames = await page.$$eval('.text-blue-400', elements => 
      elements.map(el => el.textContent?.trim())
    );
    
    console.log(`💬 Found ${displayNames.length} display names:`);
    displayNames.forEach((name, index) => {
      console.log(`  ${index + 1}. "${name}"`);
    });
    
    // Also check for any [NO PROFILE NAME] messages
    const noProfileNames = await page.$$eval('.text-gray-500', elements => 
      elements.filter(el => el.textContent?.includes('[NO PROFILE NAME]'))
        .map(el => el.textContent?.trim())
    );
    
    if (noProfileNames.length > 0) {
      console.log(`⚠️ Found ${noProfileNames.length} messages with no profile name`);
    }
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser left open for manual inspection. Close manually when done.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFrontendDisplayNames().catch(console.error);
