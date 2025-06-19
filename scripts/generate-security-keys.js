#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔐 POLMATCH SECURITY SETUP');
console.log('==========================\n');

// Generate secure encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated secure 256-bit encryption key:');
console.log(`MESSAGE_SECRET_KEY=${encryptionKey}\n`);

console.log('📝 Add this to your .env.local file:');
console.log('------------------------------------');
console.log(`MONGODB_URI=mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/`);
console.log(`MESSAGE_SECRET_KEY=${encryptionKey}`);
console.log(`NODE_ENV=development`);
console.log(`NEXT_PUBLIC_APP_URL=http://localhost:3000`);
console.log('------------------------------------\n');

console.log('⚠️  IMPORTANT SECURITY NOTES:');
console.log('- Keep the .env.local file secure and never commit it to git');
console.log('- Use different keys for development and production');
console.log('- Rotate encryption keys periodically');
console.log('- Store production keys in secure environment variable storage\n');

console.log('🚀 Next steps:');
console.log('1. Copy the environment variables to your .env.local file');
console.log('2. Restart your development server');
console.log('3. Test all application functionality');
console.log('4. Run security tests before deploying to production\n');

process.exit(0);
