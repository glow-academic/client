#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractTableNames, generateTestFiles, generateSummaryReport } = require('./generate-table-tests.js');

// Path configurations
const SCHEMA_PATH = path.join(__dirname, '../../drizzle/schema.ts');
const CACHE_PATH = path.join(__dirname, '../.schema-cache.json');

/**
 * Get file modification time
 */
function getFileModTime(filePath) {
  try {
    return fs.statSync(filePath).mtime.getTime();
  } catch (error) {
    return 0;
  }
}

/**
 * Load cached schema info
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️  Could not load schema cache:', error.message);
  }
  return { lastModified: 0, tables: [] };
}

/**
 * Save schema cache
 */
function saveCache(data) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Could not save schema cache:', error.message);
  }
}

/**
 * Compare table arrays to detect changes
 */
function detectChanges(oldTables, newTables) {
  const oldTableNames = new Set(oldTables.map(t => t.tableName));
  const newTableNames = new Set(newTables.map(t => t.tableName));
  
  const added = newTables.filter(t => !oldTableNames.has(t.tableName));
  const removed = oldTables.filter(t => !newTableNames.has(t.tableName));
  const existing = newTables.filter(t => oldTableNames.has(t.tableName));
  
  return { added, removed, existing, hasChanges: added.length > 0 || removed.length > 0 };
}

/**
 * Remove test files for deleted tables
 */
function removeObsoleteTests(removedTables) {
  const E2E_DIR = path.join(__dirname, '../e2e');
  let removedCount = 0;
  
  removedTables.forEach(table => {
    const testFilePath = path.join(E2E_DIR, table.testFileName);
    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
        console.log(`🗑️  Removed obsolete test: ${table.testFileName}`);
        removedCount++;
      } catch (error) {
        console.error(`❌ Could not remove ${table.testFileName}:`, error.message);
      }
    }
  });
  
  return removedCount;
}

/**
 * Main function to check and update tests
 */
function checkAndUpdate(force = false) {
  console.log('🔍 Checking for schema changes...');
  
  const currentModTime = getFileModTime(SCHEMA_PATH);
  const cache = loadCache();
  
  if (!force && currentModTime <= cache.lastModified) {
    console.log('✅ Schema unchanged, tests are up to date');
    return { updated: false, stats: null };
  }
  
  console.log('📊 Schema changed, updating tests...');
  
  const currentTables = extractTableNames();
  const changes = detectChanges(cache.tables, currentTables);
  
  if (changes.added.length > 0) {
    console.log(`➕ New tables detected: ${changes.added.map(t => t.tableName).join(', ')}`);
  }
  
  if (changes.removed.length > 0) {
    console.log(`➖ Removed tables detected: ${changes.removed.map(t => t.tableName).join(', ')}`);
  }
  
  // Remove obsolete test files
  const removedCount = removeObsoleteTests(changes.removed);
  
  // Generate/update test files
  const stats = generateTestFiles(currentTables);
  stats.removed = removedCount;
  
  // Generate report
  generateSummaryReport(currentTables, stats);
  
  // Update cache
  saveCache({
    lastModified: currentModTime,
    tables: currentTables
  });
  
  console.log('\n📊 Update Summary:');
  console.log(`  ✨ Created: ${stats.created} files`);
  console.log(`  🔄 Updated: ${stats.updated} files`);
  console.log(`  🗑️  Removed: ${stats.removed} files`);
  console.log(`  ⏭️  Skipped: ${stats.skipped} files`);
  
  return { updated: true, stats, changes };
}

/**
 * Watch mode - continuously monitor schema file
 */
function watchMode() {
  console.log('👀 Watching schema file for changes...');
  console.log(`📁 Monitoring: ${SCHEMA_PATH}`);
  console.log('🛑 Press Ctrl+C to stop\n');
  
  // Initial check
  checkAndUpdate(true);
  
  // Watch for changes
  fs.watchFile(SCHEMA_PATH, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
      console.log('\n🔄 Schema file changed!');
      checkAndUpdate();
      console.log('👀 Continuing to watch...\n');
    }
  });
}

/**
 * CLI interface
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'watch':
      watchMode();
      break;
    case 'check':
      const result = checkAndUpdate();
      process.exit(result.updated ? 1 : 0); // Exit 1 if changes were made
      break;
    case 'force':
      checkAndUpdate(true);
      break;
    default:
      console.log(`
🔧 Schema Change Monitor

Usage:
  node watch-schema-changes.js [command]

Commands:
  check   - Check for changes and update if needed (exit 1 if changes made)
  force   - Force update regardless of modification time
  watch   - Watch schema file continuously for changes
  
Examples:
  node watch-schema-changes.js check
  node watch-schema-changes.js watch
  node watch-schema-changes.js force
      `);
      break;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping schema watcher...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkAndUpdate, watchMode }; 