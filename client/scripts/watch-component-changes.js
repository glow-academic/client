#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  scanComponentFiles,
  generateTestFiles,
  generateCoverageReport,
} = require("./generate-component-tests");

// Path configurations
const COMPONENTS_DIR = path.join(__dirname, "../components");
const CACHE_FILE = path.join(__dirname, "../.component-cache.json");

/**
 * Get modification times for all component files
 */
function getComponentModTimes() {
  const components = scanComponentFiles(COMPONENTS_DIR);
  const modTimes = {};

  components.forEach((component) => {
    try {
      const stat = fs.statSync(component.componentFullPath);
      modTimes[component.componentPath] = stat.mtime.getTime();
    } catch (error) {
      console.error(
        `❌ Error reading ${component.componentPath}:`,
        error.message,
      );
    }
  });

  return modTimes;
}

/**
 * Load cached modification times
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      return cache;
    }
  } catch (error) {
    console.error("❌ Error loading cache:", error.message);
  }
  return {};
}

/**
 * Save modification times to cache
 */
function saveCache(modTimes) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(modTimes, null, 2));
  } catch (error) {
    console.error("❌ Error saving cache:", error.message);
  }
}

/**
 * Check for component changes
 */
function checkForChanges() {
  console.log("🔍 Checking for component changes...");

  const currentModTimes = getComponentModTimes();
  const cachedModTimes = loadCache();

  const changes = {
    added: [],
    modified: [],
    removed: [],
  };

  // Check for new and modified components
  Object.keys(currentModTimes).forEach((componentPath) => {
    if (!cachedModTimes[componentPath]) {
      changes.added.push(componentPath);
    } else if (
      currentModTimes[componentPath] !== cachedModTimes[componentPath]
    ) {
      changes.modified.push(componentPath);
    }
  });

  // Check for removed components
  Object.keys(cachedModTimes).forEach((componentPath) => {
    if (!currentModTimes[componentPath]) {
      changes.removed.push(componentPath);
    }
  });

  const hasChanges =
    changes.added.length > 0 ||
    changes.modified.length > 0 ||
    changes.removed.length > 0;

  if (hasChanges) {
    console.log("\n📊 Component changes detected:");
    if (changes.added.length > 0) {
      console.log(`  ➕ Added (${changes.added.length}):`);
      changes.added.forEach((comp) => console.log(`    - ${comp}`));
    }
    if (changes.modified.length > 0) {
      console.log(`  ✏️  Modified (${changes.modified.length}):`);
      changes.modified.forEach((comp) => console.log(`    - ${comp}`));
    }
    if (changes.removed.length > 0) {
      console.log(`  ❌ Removed (${changes.removed.length}):`);
      changes.removed.forEach((comp) => console.log(`    - ${comp}`));
    }

    return { hasChanges: true, changes, currentModTimes };
  } else {
    console.log("✅ No component changes detected");
    return { hasChanges: false, changes, currentModTimes };
  }
}

/**
 * Remove test files for deleted components
 */
function cleanupRemovedTests(removedComponents) {
  const { scanComponentFiles } = require("./generate-component-tests");
  const TESTS_DIR = path.join(__dirname, "../__tests__");

  removedComponents.forEach((componentPath) => {
    const componentName = path.basename(componentPath, ".tsx");
    const relativePath = path.dirname(componentPath);
    const testDir = path.join(TESTS_DIR, relativePath);
    const testFilePath = path.join(testDir, `${componentName}.test.tsx`);

    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
        console.log(`🗑️  Removed test file: ${componentName}.test.tsx`);
      } catch (error) {
        console.error(
          `❌ Error removing test file ${testFilePath}:`,
          error.message,
        );
      }
    }
  });
}

/**
 * Regenerate tests for changed components
 */
function regenerateTests() {
  console.log("\n🔄 Regenerating component tests...");

  const components = scanComponentFiles(COMPONENTS_DIR);
  const stats = generateTestFiles(components);

  console.log("\n📊 Regeneration Summary:");
  console.log(`  ✨ Created: ${stats.created} files`);
  console.log(`  🔄 Updated: ${stats.updated} files`);
  console.log(`  ⏭️  Skipped: ${stats.skipped} files`);

  generateCoverageReport(components, stats);

  return stats;
}

/**
 * Watch for component changes
 */
function watchComponents() {
  console.log("👀 Watching for component changes...");
  console.log("Press Ctrl+C to stop watching\n");

  // Initial check
  const initialCheck = checkForChanges();
  if (initialCheck.hasChanges) {
    if (initialCheck.changes.removed.length > 0) {
      cleanupRemovedTests(initialCheck.changes.removed);
    }
    regenerateTests();
  }
  saveCache(initialCheck.currentModTimes);

  // Watch for changes every 2 seconds
  const interval = setInterval(() => {
    const result = checkForChanges();
    if (result.hasChanges) {
      if (result.changes.removed.length > 0) {
        cleanupRemovedTests(result.changes.removed);
      }
      regenerateTests();
      saveCache(result.currentModTimes);
    }
  }, 2000);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n👋 Stopping component watcher...");
    clearInterval(interval);
    process.exit(0);
  });
}

/**
 * Force regeneration of all tests
 */
function forceRegenerate() {
  console.log("🔄 Force regenerating all component tests...");

  const components = scanComponentFiles(COMPONENTS_DIR);
  const stats = generateTestFiles(components);

  console.log("\n📊 Force Regeneration Summary:");
  console.log(`  ✨ Created: ${stats.created} files`);
  console.log(`  🔄 Updated: ${stats.updated} files`);
  console.log(`  ⏭️  Skipped: ${stats.skipped} files`);

  generateCoverageReport(components, stats);

  // Update cache
  const modTimes = getComponentModTimes();
  saveCache(modTimes);

  console.log("\n✅ Force regeneration complete!");
}

/**
 * Main CLI interface
 */
function main() {
  const command = process.argv[2];

  switch (command) {
    case "check":
      const result = checkForChanges();
      process.exit(result.hasChanges ? 1 : 0);
      break;

    case "watch":
      watchComponents();
      break;

    case "force":
      forceRegenerate();
      break;

    default:
      console.log(`
🧪 Component Test Watcher

Usage:
  node scripts/watch-component-changes.js <command>

Commands:
  check   - Check for component changes (exit code 1 if changes found)
  watch   - Watch for component changes and auto-regenerate tests
  force   - Force regenerate all component tests

Examples:
  npm run test:components:check
  npm run test:components:watch
  npm run test:components:force
`);
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkForChanges, watchComponents, forceRegenerate };
