#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that have the pattern "const client = new MongoClient(MONGODB_URI);" 
// and need the MONGODB_URI check added
const filesToFix = [
  'app/api/internal/check-ip-ban/route.ts',
  'app/api/groups/join/route.ts',
  'app/api/groups/discover/route.ts',
  'app/api/groups/[id]/route.ts',
  'app/api/groups/[id]/members/role/route.ts',
  'app/api/groups/[id]/members/unban/route.ts',
  'app/api/groups/[id]/members/route.ts',
  'app/api/groups/[id]/messages/read/route.ts',
  'app/api/groups/[id]/members/ban/route.ts',
  'app/api/groups/[id]/members/remove/route.ts',
  'app/api/groups/[id]/members/[memberId]/role/route.ts',
  'app/api/groups/[id]/channels/route.ts',
  'app/api/groups/create/route.ts',
  'app/api/groups/leave/route.ts',
  'app/api/groups/[id]/banned/route.ts',
  'app/api/groups/[id]/unban/route.ts'
];

console.log('🔧 Fixing MONGODB_URI type errors in API routes...\n');

let fixed = 0;
let skipped = 0;

for (const filePath of filesToFix) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    skipped++;
    continue;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if it already has the MONGODB_URI check
    if (content.includes('if (!MONGODB_URI)')) {
      console.log(`✅ Already fixed: ${filePath}`);
      skipped++;
      continue;
    }
    
    // Check if it has the problematic pattern
    if (!content.includes('new MongoClient(MONGODB_URI)')) {
      console.log(`⚠️  Pattern not found: ${filePath}`);
      skipped++;
      continue;
    }
    
    // Find the line with MONGODB_URI import
    const importMatch = content.match(/(import.*MONGODB_URI.*from.*['"][^'"]+['"];?\n)/);
    if (!importMatch) {
      console.log(`⚠️  MONGODB_URI import not found: ${filePath}`);
      skipped++;
      continue;
    }
    
    // Add the check after the imports but before the MongoClient instantiation
    const checkCode = `
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}
`;
    
    // Find where to insert the check - after all imports but before any code
    const lines = content.split('\n');
    let insertIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('//') || line === '') {
        continue;
      } else {
        insertIndex = i;
        break;
      }
    }
    
    if (insertIndex === -1) {
      console.log(`⚠️  Could not find insertion point: ${filePath}`);
      skipped++;
      continue;
    }
    
    // Insert the check
    lines.splice(insertIndex, 0, checkCode);
    const newContent = lines.join('\n');
    
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    fixed++;
    
  } catch (error) {
    console.log(`❌ Error fixing ${filePath}: ${error.message}`);
    skipped++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`✅ Fixed: ${fixed} files`);
console.log(`⚠️  Skipped: ${skipped} files`);
console.log(`\n🚀 All MONGODB_URI type errors should now be resolved!`);

process.exit(0);
