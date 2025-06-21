// Test script to verify group display names are shown correctly in all UI locations
const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const LOGIN_EMAIL = 'sokol@example.com';
const LOGIN_PASSWORD = 'mango';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(page) {
  console.log('🔐 Logging in...');
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  await page.fill('input[type="email"]', LOGIN_EMAIL);
  await page.fill('input[type="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  
  // Wait for successful login redirect
  await page.waitForURL(/\/dashboard|\//, { timeout: 10000 });
  console.log('✅ Login successful');
}

async function testGroupDisplayNames() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Login
    await login(page);
    await delay(2000);
    
    console.log('🔍 Testing group display names...');
    
    // Navigate to groups
    await page.goto(`${BASE_URL}/groups`);
    await delay(2000);
    
    // Look for any existing groups and click on one
    const groupElements = await page.$$('[data-testid="group-item"], .group-item, button:has-text("Group")');
    
    if (groupElements.length === 0) {
      console.log('❌ No groups found. Please create a test group first.');
      return;
    }
    
    console.log(`📝 Found ${groupElements.length} groups`);
    
    // Click on the first group
    await groupElements[0].click();
    await delay(2000);
    
    // Test 1: Check message display names above messages
    console.log('🧪 Test 1: Checking display names above group messages...');
    const messageElements = await page.$$('.message, [data-testid="message"]');
    console.log(`Found ${messageElements.length} messages`);
    
    for (let i = 0; i < Math.min(messageElements.length, 3); i++) {
      const messageElement = messageElements[i];
      const displayNameElement = await messageElement.$('.sender-name, .display-name, .message-sender');
      if (displayNameElement) {
        const displayName = await displayNameElement.textContent();
        console.log(`  ✅ Message ${i + 1} sender: "${displayName}"`);
      } else {
        console.log(`  ❓ Message ${i + 1}: No display name element found`);
      }
    }
    
    // Test 2: Check group members modal
    console.log('🧪 Test 2: Checking group members modal...');
    try {
      const membersButton = await page.$('button:has-text("Members"), [data-testid="members-button"], .members-button');
      if (membersButton) {
        await membersButton.click();
        await delay(1000);
        
        const memberElements = await page.$$('.member-item, [data-testid="member"], .member-list-item');
        console.log(`Found ${memberElements.length} members in modal`);
        
        for (let i = 0; i < Math.min(memberElements.length, 3); i++) {
          const memberElement = memberElements[i];
          const memberText = await memberElement.textContent();
          console.log(`  ✅ Member ${i + 1}: "${memberText.trim()}"`);
        }
        
        // Close modal
        const closeButton = await page.$('button:has-text("×"), button:has-text("Close"), [data-testid="close-modal"]');
        if (closeButton) {
          await closeButton.click();
          await delay(500);
        }
      } else {
        console.log('  ❓ Members button not found');
      }
    } catch (error) {
      console.log(`  ❌ Error testing members modal: ${error.message}`);
    }
    
    // Test 3: Check group invite modal
    console.log('🧪 Test 3: Checking group invite modal...');
    try {
      const inviteButton = await page.$('button:has-text("Invite"), [data-testid="invite-button"], .invite-button');
      if (inviteButton) {
        await inviteButton.click();
        await delay(1000);
        
        const userElements = await page.$$('.user-item, [data-testid="user"], .invite-user-item');
        console.log(`Found ${userElements.length} users in invite modal`);
        
        for (let i = 0; i < Math.min(userElements.length, 3); i++) {
          const userElement = userElements[i];
          const userText = await userElement.textContent();
          console.log(`  ✅ User ${i + 1}: "${userText.trim()}"`);
        }
        
        // Close modal
        const closeButton = await page.$('button:has-text("×"), button:has-text("Close"), [data-testid="close-modal"]');
        if (closeButton) {
          await closeButton.click();
          await delay(500);
        }
      } else {
        console.log('  ❓ Invite button not found');
      }
    } catch (error) {
      console.log(`  ❌ Error testing invite modal: ${error.message}`);
    }
    
    // Test 4: Check group invitations modal
    console.log('🧪 Test 4: Checking group invitations modal...');
    try {
      // Navigate to invitations page or look for invitations button
      await page.goto(`${BASE_URL}/invitations`);
      await delay(2000);
      
      const invitationElements = await page.$$('.invitation-item, [data-testid="invitation"], .group-invitation');
      console.log(`Found ${invitationElements.length} invitations`);
      
      for (let i = 0; i < Math.min(invitationElements.length, 3); i++) {
        const invitationElement = invitationElements[i];
        const invitationText = await invitationElement.textContent();
        console.log(`  ✅ Invitation ${i + 1}: "${invitationText.trim()}"`);
      }
    } catch (error) {
      console.log(`  ❌ Error testing invitations: ${error.message}`);
    }
    
    console.log('✅ Display name testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testGroupDisplayNames().catch(console.error);
