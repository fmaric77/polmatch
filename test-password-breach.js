// Test script for HaveIBeenPwned password breach checking
const crypto = require('crypto');

async function testPasswordBreach(password) {
  try {
    // Create SHA-1 hash of password
    const hash = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    console.log(`Testing password: "${password}"`);
    console.log(`SHA-1 Hash: ${hash}`);
    console.log(`Prefix (sent to API): ${prefix}`);
    console.log(`Suffix (to match): ${suffix}`);
    
    // Query HaveIBeenPwned API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Polmatch-Password-Validator-Test/1.0'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ API request failed: ${response.status}`);
      return;
    }
    
    const data = await response.text();
    console.log(`✅ API response received (${data.split('\n').length} entries)`);
    
    // Check if our password hash suffix appears in the results
    const lines = data.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10);
        console.log(`🚨 PASSWORD FOUND IN BREACHES: ${count.toLocaleString()} times`);
        return { isBreached: true, count };
      }
    }
    
    console.log(`✅ Password not found in breaches`);
    return { isBreached: false };
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Test with known breached passwords
async function runTests() {
  console.log('=== Testing HaveIBeenPwned Password Breach API ===\n');
  
  // Test known breached password
  await testPasswordBreach('password');
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test another known breached password
  await testPasswordBreach('123456');
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test a likely secure password
  await testPasswordBreach('MyVerySecurePassword2024!@#$%');
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('Test completed!');
}

runTests(); 