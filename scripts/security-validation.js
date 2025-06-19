#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 POLMATCH SECURITY VALIDATION');
console.log('===============================\n');

let securityScore = 0;
let totalChecks = 0;
const issues = [];
const passed = [];

function checkFile(filePath, description) {
  totalChecks++;
  if (fs.existsSync(filePath)) {
    securityScore++;
    passed.push(`✅ ${description}`);
    return true;
  } else {
    issues.push(`❌ ${description} (${filePath} not found)`);
    return false;
  }
}

function checkEnvironmentVar(varName, description) {
  totalChecks++;
  const envFile = path.join(process.cwd(), '.env.local');
  
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    if (content.includes(`${varName}=`) && !content.includes(`${varName}=your-`) && !content.includes(`${varName}=default`)) {
      securityScore++;
      passed.push(`✅ ${description}`);
      return true;
    }
  }
  
  issues.push(`❌ ${description} (${varName} not properly configured)`);
  return false;
}

function checkCodePattern(filePath, pattern, description, shouldNotExist = false) {
  totalChecks++;
  
  if (!fs.existsSync(filePath)) {
    issues.push(`❌ Cannot check ${description} (${filePath} not found)`);
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const hasPattern = pattern.test(content);
  
  if (shouldNotExist) {
    if (!hasPattern) {
      securityScore++;
      passed.push(`✅ ${description}`);
      return true;
    } else {
      issues.push(`❌ ${description} (found security issue)`);
      return false;
    }
  } else {
    if (hasPattern) {
      securityScore++;
      passed.push(`✅ ${description}`);
      return true;
    } else {
      issues.push(`❌ ${description} (security measure not found)`);
      return false;
    }
  }
}

// Environment Configuration
console.log('📁 Environment Configuration:');
checkFile('.env.local', 'Environment file exists');
checkEnvironmentVar('MONGODB_URI', 'MongoDB URI configured');
checkEnvironmentVar('MESSAGE_SECRET_KEY', 'Message encryption key configured');
checkFile('.gitignore', 'Git ignore file exists');

// Security Headers
console.log('\n🛡️  Security Headers:');
checkCodePattern('middleware.ts', /X-XSS-Protection/, 'XSS protection header');
checkCodePattern('middleware.ts', /X-Content-Type-Options/, 'MIME sniffing protection');
checkCodePattern('middleware.ts', /X-Frame-Options/, 'Clickjacking protection');
checkCodePattern('middleware.ts', /Content-Security-Policy/, 'Content Security Policy');

// Authentication Security
console.log('\n🔐 Authentication Security:');
checkCodePattern('app/api/login/route.ts', /bcrypt/, 'Password hashing');
checkCodePattern('lib/auth.ts', /expires.*gt.*new Date/, 'Session expiration check');
checkCodePattern('app/api/login/route.ts', /MAX_ATTEMPTS/, 'Brute force protection');

// Input Validation
console.log('\n🧹 Input Validation:');
checkCodePattern('lib/validation.ts', /sanitizeText/, 'Text sanitization');
checkCodePattern('lib/validation.ts', /validateUUID/, 'UUID validation');
checkCodePattern('lib/validation.ts', /checkRateLimit/, 'Rate limiting');

// Vulnerability Checks
console.log('\n🚨 Vulnerability Checks:');
checkCodePattern('app/api/mongo-uri.ts', /mongodb\+srv:\/\/.*@/, 'No hardcoded DB credentials', true);
checkCodePattern('app/api/sse/route.ts', /Access-Control-Allow-Origin.*\*/, 'No wildcard CORS', true);
checkCodePattern('app/api/messages/route.ts', /default_secret_key/, 'No default encryption keys', true);

console.log('\n📊 SECURITY SCORE');
console.log('==================');

const scorePercentage = Math.round((securityScore / totalChecks) * 100);
console.log(`Score: ${securityScore}/${totalChecks} (${scorePercentage}%)\n`);

if (scorePercentage >= 90) {
  console.log('🟢 EXCELLENT SECURITY - Well protected!');
} else if (scorePercentage >= 75) {
  console.log('🟡 GOOD SECURITY - Minor improvements needed');
} else if (scorePercentage >= 50) {
  console.log('🟠 MODERATE SECURITY - Several issues to address');
} else {
  console.log('🔴 POOR SECURITY - Critical issues need immediate attention');
}

if (passed.length > 0) {
  console.log('\n✅ PASSED CHECKS:');
  passed.forEach(check => console.log(`  ${check}`));
}

if (issues.length > 0) {
  console.log('\n❌ FAILED CHECKS:');
  issues.forEach(issue => console.log(`  ${issue}`));
  
  console.log('\n🔧 RECOMMENDATIONS:');
  console.log('- Run: node scripts/generate-security-keys.js');
  console.log('- Ensure all environment variables are properly set');
  console.log('- Review SECURITY_AUDIT_REPORT.md for detailed fixes');
  console.log('- Test application functionality after applying fixes');
}

console.log('\n📋 NEXT STEPS:');
console.log('- Review and implement failed security checks');
console.log('- Test application with new security measures');
console.log('- Consider implementing CSRF protection');
console.log('- Set up security monitoring and logging');

process.exit(issues.length > 0 ? 1 : 0);
