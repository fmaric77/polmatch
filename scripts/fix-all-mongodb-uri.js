#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that need MONGODB_URI validation added
const filesToFix = [
  'app/api/lib/auth.ts',
];

// API files that import from mongo-uri and need validation
const apiFiles = [
  'app/api/admin/ban-user/route.ts',
  'app/api/admin/create-user/route.ts', 
  'app/api/questionnaires/route.ts',
  'app/api/questionnaires/[id]/route.ts',
  'app/api/friends/route.ts',
  'app/api/friends/respond/route.ts',
  'app/api/groups/[id]/members/ban/route.ts',
  'app/api/groups/[id]/route.ts',
  'app/api/groups/create/route.ts',
  'app/api/admin/questionnaires/[id]/questionnaires/[questionnaireId]/route.ts',
  'app/api/admin/questionnaires/[id]/route.ts',
  'app/api/groups/leave/route.ts',
  'app/api/groups/discover/route.ts',
  'app/api/groups/join/route.ts',
  'app/api/groups/[id]/banned/route.ts',
  'app/api/groups/[id]/channels/route.ts',
  'app/api/groups/[id]/messages/read/route.ts',
  'app/api/groups/[id]/members/route.ts',
  'app/api/groups/[id]/members/role/route.ts',
  'app/api/groups/[id]/members/unban/route.ts',
  'app/api/groups/[id]/members/remove/route.ts',
  'app/api/groups/[id]/members/[memberId]/role/route.ts',
  'app/api/groups/[id]/unban/route.ts',
  'app/api/friends/request/route.ts'
];

function fixMongoDBURIValidation(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping ${filePath} (file not found)`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Skip if already has validation
  if (content.includes('if (!MONGODB_URI)')) {
    console.log(`✅ ${filePath} already has MONGODB_URI validation`);
    return false;
  }
  
  // Skip if doesn't use MongoClient with MONGODB_URI
  if (!content.includes('new MongoClient(MONGODB_URI)')) {
    console.log(`⏭️  Skipping ${filePath} (doesn't use MongoClient with MONGODB_URI)`);
    return false;
  }
  
  // Find where MONGODB_URI is imported
  const mongoUriImportMatch = content.match(/import MONGODB_URI from ['"](.*?)['"];/);
  if (!mongoUriImportMatch) {
    console.log(`⚠️  ${filePath} imports MONGODB_URI but pattern not found`);
    return false;
  }
  
  // Find the MongoClient instantiation line
  const mongoClientMatch = content.match(/const client = new MongoClient\(MONGODB_URI\);/);
  if (!mongoClientMatch) {
    console.log(`⚠️  ${filePath} has MONGODB_URI but MongoClient pattern not found`);
    return false;
  }
  
  // Add validation after imports and before MongoClient instantiation
  const validationCode = `
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}
`;
  
  const newContent = content.replace(
    /const client = new MongoClient\(MONGODB_URI\);/,
    `${validationCode}
const client = new MongoClient(MONGODB_URI);`
  );
  
  if (newContent === content) {
    console.log(`❌ Failed to fix ${filePath} - no changes made`);
    return false;
  }
  
  fs.writeFileSync(fullPath, newContent);
  console.log(`🔧 Fixed ${filePath}`);
  return true;
}

function fixLibAuthFile() {
  const filePath = 'lib/auth.ts';
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping ${filePath} (file not found)`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Skip if already has validation
  if (content.includes('if (!MONGODB_URI)')) {
    console.log(`✅ ${filePath} already has MONGODB_URI validation`);
    return false;
  }
  
  // For lib/auth.ts, add validation after the import but before any function that uses MongoClient
  const validationCode = `
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}
`;
  
  // Find the import line and add validation after it
  const newContent = content.replace(
    /(import.*MONGODB_URI.*;\n)/,
    `$1${validationCode}`
  );
  
  if (newContent === content) {
    console.log(`❌ Failed to fix ${filePath} - no changes made`);
    return false;
  }
  
  fs.writeFileSync(fullPath, newContent);
  console.log(`🔧 Fixed ${filePath}`);
  return true;
}

console.log('🔍 Fixing MONGODB_URI validation in all files...\n');

let fixedCount = 0;

// Fix lib/auth.ts first
if (fixLibAuthFile()) {
  fixedCount++;
}

// Fix all API route files
for (const filePath of apiFiles) {
  if (fixMongoDBURIValidation(filePath)) {
    fixedCount++;
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log('\n🚀 All MONGODB_URI validation issues should now be resolved!');
console.log('Run "npm run build" to verify the fixes.');
