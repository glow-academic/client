#!/usr/bin/env node
// Wrapper script for chokidar to pass changed file path to make sql-compile-incremental
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if types.py exists and has reasonable content
// If not, run full compilation first (one-time check using a flag file)
const projectRoot = path.resolve(__dirname, '..', '..');
const typesFile = path.resolve(projectRoot, 'server/app/sql/types.py');
const checkFlagFile = path.resolve(projectRoot, '.sql-types-checked');

// Only check once per session (using flag file)
if (!fs.existsSync(checkFlagFile)) {
  if (!fs.existsSync(typesFile)) {
    console.log('⚠️  types.py not found. Running full compilation first...');
    try {
      execSync('make sql-compile', {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Failed to run full compilation:', error.message);
      process.exit(error.status || 1);
    }
  } else {
    // Check if types.py has reasonable content (at least 10 registry entries)
    const content = fs.readFileSync(typesFile, 'utf8');
    const registryEntries = (content.match(/":\s*\(/g) || []).length;
    if (registryEntries < 10) {
      console.log(
        `⚠️  types.py appears incomplete (found ${registryEntries} entries, expected many more). Running full compilation first...`
      );
      try {
        execSync('make sql-compile', {
          cwd: projectRoot,
          stdio: 'inherit',
        });
      } catch (error) {
        console.error('Failed to run full compilation:', error.message);
        process.exit(error.status || 1);
      }
    }
  }
  // Create flag file to indicate we've checked
  fs.writeFileSync(checkFlagFile, new Date().toISOString());
}

// Get the changed file path from command line arguments
// chokidar passes the file path as the first argument
const changedFile = process.argv[2];

if (!changedFile) {
  console.error('No file path provided');
  process.exit(1);
}

// Convert to relative path from project root
let relativePath = changedFile;

// Handle different path formats that chokidar might pass
if (path.isAbsolute(changedFile)) {
  // Absolute path - convert to relative
  relativePath = path.relative(projectRoot, changedFile);
} else if (changedFile.startsWith('../server/')) {
  // Relative path starting with ../server/
  relativePath = changedFile.replace('../server/', 'server/');
} else if (changedFile.startsWith('server/')) {
  // Already relative to project root
  relativePath = changedFile;
} else {
  // Try to resolve relative to project root
  const resolvedPath = path.resolve(projectRoot, changedFile);
  relativePath = path.relative(projectRoot, resolvedPath);
}

// The Python script expects paths relative to the server directory, not project root
// Strip the 'server/' prefix if present
if (relativePath.startsWith('server/')) {
  relativePath = relativePath.replace(/^server\//, '');
}

// Call make sql-compile-incremental with the file path
try {
  execSync(`make sql-compile-incremental FILE="${relativePath}"`, {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'inherit',
  });
} catch (error) {
  // Exit with the same code
  process.exit(error.status || 1);
}
