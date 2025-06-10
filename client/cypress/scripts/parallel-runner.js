#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Dynamic configuration from package.json and file system
function getConfig() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Extract server URL from dev script or use default
  let serverUrl = 'http://localhost:3000';
  const devScript = packageJson.scripts?.dev || '';
  if (devScript.includes('next dev')) {
    // Next.js default is 3000, but could be customized
    const portMatch = devScript.match(/--port\s+(\d+)/);
    if (portMatch) {
      serverUrl = `http://localhost:${portMatch[1]}`;
    }
  }
  
  // Auto-detect test files
  const testDir = 'cypress/e2e';
  const testFiles = fs.existsSync(testDir) 
    ? fs.readdirSync(testDir)
        .filter(file => file.endsWith('.cy.ts') || file.endsWith('.cy.js'))
        .sort()
    : [];
  
  return {
    testFiles,
    serverUrl,
    workers: parseInt(process.env.CYPRESS_WORKERS) || Math.min(4, Math.max(2, Math.ceil(testFiles.length / 6))),
    browser: process.env.CYPRESS_BROWSER || 'chrome',
    headless: process.env.CYPRESS_HEADLESS !== 'false'
  };
}

// Check if server is running
async function checkServer(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: '/',
      method: 'GET',
      timeout: 3000
    }, () => resolve(true));
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// Start dev server if needed
async function ensureServer(serverUrl) {
  console.log(`🔍 Checking server at ${serverUrl}...`);
  
  if (await checkServer(serverUrl)) {
    console.log('✅ Server already running');
    return null;
  }
  
  console.log('🚀 Starting dev server...');
  const server = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
  
  return new Promise((resolve, reject) => {
    let started = false;
    
    server.stdout.on('data', (data) => {
      const msg = data.toString();
      if ((msg.includes('Ready') || msg.includes('localhost') || msg.includes('started')) && !started) {
        started = true;
        console.log('✅ Server ready');
        resolve(server);
      }
    });
    
    server.on('error', reject);
    setTimeout(() => !started && reject(new Error('Server timeout')), 60000);
  });
}

// Run test chunk
function runTests(testFiles, workerIndex, config) {
  return new Promise((resolve, reject) => {
    const specs = testFiles.map(f => `cypress/e2e/${f}`).join(',');
    const args = [
      'run', '--spec', specs, '--browser', config.browser,
      '--config', `video=false,baseUrl=${config.serverUrl}`
    ];
    
    if (config.headless) args.push('--headless');
    
    const cypress = spawn('npx', ['cypress', ...args], { stdio: 'pipe' });
    
    cypress.stdout.on('data', (data) => {
      console.log(`[${workerIndex}] ${data.toString().trim()}`);
    });
    
    cypress.on('close', (code) => {
      code === 0 ? resolve(workerIndex) : reject({ workerIndex, code });
    });
  });
}

// Main function
async function main() {
  const config = getConfig();
  
  if (config.testFiles.length === 0) {
    console.log('❌ No test files found in cypress/e2e/');
    process.exit(1);
  }
  
  console.log(`🧪 Running ${config.testFiles.length} tests with ${config.workers} workers`);
  
  // Start server if needed
  const server = await ensureServer(config.serverUrl);
  
  try {
    // Split tests into chunks
    const chunkSize = Math.ceil(config.testFiles.length / config.workers);
    const chunks = [];
    for (let i = 0; i < config.testFiles.length; i += chunkSize) {
      chunks.push(config.testFiles.slice(i, i + chunkSize));
    }
    
    // Run tests in parallel
    const startTime = Date.now();
    const results = await Promise.allSettled(
      chunks.map((chunk, i) => runTests(chunk, i + 1, config))
    );
    
    // Report results
    const duration = (Date.now() - startTime) / 1000;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`\n📊 Results: ${results.length - failed}/${results.length} workers passed (${duration.toFixed(1)}s)`);
    
    if (failed > 0) {
      console.log('❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('✅ All tests passed!');
    }
    
  } finally {
    // Cleanup
    if (server && !server.killed) {
      server.kill('SIGTERM');
      setTimeout(() => server.kill('SIGKILL'), 5000);
    }
  }
}

// Handle interrupts
process.on('SIGINT', () => process.exit(1));
process.on('SIGTERM', () => process.exit(1));

main().catch(console.error); 