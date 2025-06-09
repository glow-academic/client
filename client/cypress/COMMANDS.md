# Cypress Testing Commands Quick Reference

## 🚀 Automatic Table Test Generation

### Basic Generation
```bash
# Generate test files for all database tables
npm run test:tables:generate

# Generate advanced test files with detailed schema analysis
npm run test:tables:advanced

# Run table tests after generation
npm run test:tables

# Open Cypress UI for table tests
npm run test:tables:open
```

### Schema Monitoring
```bash
# Check for schema changes and update tests if needed
npm run test:tables:check

# Watch schema file continuously for changes (runs until stopped)
npm run test:tables:watch
```

### Development Integration
```bash
# Start dev server with automatic test generation
npm run dev
```

## 🧪 Running Tests

### Table Tests
```bash
# Run all table tests (excludes core tests)
npm run test:tables

# Run specific table test
npm run cypress:run -- --spec "cypress/e2e/users.cy.ts"

# Open Cypress UI for specific table
npm run cypress:open -- --e2e --spec "cypress/e2e/users.cy.ts"
```

### Core Application Tests
```bash
# Run comprehensive core test suite
npm run test:core

# Run authentication tests
npm run test:login

# Run chat functionality tests
npm run test:chat

# Run management interface tests
npm run test:management

# Open management tests in Cypress UI
npm run test:management:open

# Run navigation tests
npm run test:navigation
```

### All Tests
```bash
# Run all end-to-end tests
npm run test:e2e

# Run tests headless
npm run test:e2e:headless

# Open Cypress UI
npm run cypress:open

# Run Cypress headless
npm run cypress:run
```

## 🔧 Development & Testing Workflow

### Combined Development
```bash
# Start frontend + run tests when ready
npm run test:dev

# Start frontend + open Cypress UI when ready
npm run test:dev:open
```

### Service Management
```bash
# Setup and check services
npm run test:setup

# Stop services
npm run services:stop

# Restart services
npm run services:restart

# Clean test environment
npm run test:clean
```

## 📊 Direct Script Usage

### Test Generation Scripts
```bash
# Basic test generator
node cypress/scripts/generate-table-tests.js

# Advanced schema-aware generator
node cypress/scripts/advanced-test-generator.js

# Schema change monitor
node cypress/scripts/watch-schema-changes.js [check|watch|force]
```

### Schema Watcher Commands
```bash
# Check for changes (exit 1 if changes detected)
node cypress/scripts/watch-schema-changes.js check

# Force regeneration regardless of modification time
node cypress/scripts/watch-schema-changes.js force

# Watch continuously (Ctrl+C to stop)
node cypress/scripts/watch-schema-changes.js watch
```

## 🎯 Common Workflows

### Setting Up Table Tests for New Project
```bash
# 1. Generate all table tests
npm run test:tables:advanced

# 2. Check coverage report
cat cypress/e2e/table-test-coverage.md

# 3. Start implementing tests (they all fail by design)
npm run test:tables:open
```

### Daily Development
```bash
# Start development with auto-test generation
npm run dev

# In another terminal, watch for schema changes
npm run test:tables:watch
```

### Before Committing
```bash
# Check if schema changes require test updates
npm run test:tables:check

# Run all tests to ensure nothing is broken
npm run test:e2e
```

### Debugging Specific Table
```bash
# Open Cypress UI for specific table
npm run cypress:open -- --e2e --spec "cypress/e2e/users.cy.ts"

# Run specific table test in terminal
npm run cypress:run -- --spec "cypress/e2e/users.cy.ts"
```

## 📁 File Locations

- **Generated Tests**: `cypress/e2e/*.cy.ts` (except `core-*.cy.ts`)
- **Core Tests**: `cypress/e2e/core-*.cy.ts`
- **Coverage Report**: `cypress/e2e/table-test-coverage.md`
- **Schema Cache**: `cypress/.schema-cache.json`
- **Scripts**: `cypress/scripts/`

## 🚨 Important Notes

1. **Failing Tests by Design**: All generated tests fail until you implement them
2. **Core Tests Protected**: Files starting with `core-` are never auto-generated
3. **Schema Changes**: The system automatically detects schema changes when you run `npm run dev`
4. **Cache Management**: Delete `cypress/.schema-cache.json` to force full regeneration
5. **Exit Codes**: `npm run test:tables:check` exits with code 1 if changes were made

## 🔍 Troubleshooting Commands

```bash
# Clear cache and force regeneration
rm cypress/.schema-cache.json && npm run test:tables:generate

# Check if schema file is readable
node -e "console.log(require('fs').readFileSync('drizzle/schema.ts', 'utf8').length)"

# Verify Cypress installation
npx cypress verify

# Check service status
npm run test:setup -- -c
``` 