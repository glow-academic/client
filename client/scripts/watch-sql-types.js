#!/usr/bin/env node
// Wrapper script for chokidar to pass changed file path to make sql-compile-incremental
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the changed file path from command line arguments
// chokidar passes the file path as the first argument
const changedFile = process.argv[2];

if (!changedFile) {
  console.error('No file path provided');
  process.exit(1);
}

// Convert to relative path from project root
const projectRoot = path.resolve(__dirname, '..', '..');
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
