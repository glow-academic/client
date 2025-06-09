#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path configurations
const SCHEMA_PATH = path.join(__dirname, '../../drizzle/schema.ts');
const E2E_DIR = path.join(__dirname, '../e2e');
const CORE_TEST_PREFIX = 'core-';

/**
 * Extract table names from Drizzle schema file
 */
function extractTableNames() {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Match export const tableName = pgTable("table_name", ...)
    const tableRegex = /export const (\w+) = pgTable\("([^"]+)"/g;
    const tables = [];
    let match;
    
    while ((match = tableRegex.exec(schemaContent)) !== null) {
      const [, exportName, tableName] = match;
      tables.push({
        exportName,
        tableName,
        testFileName: `${tableName.replace(/_/g, '-')}.cy.ts`
      });
    }
    
    console.log(`📊 Found ${tables.length} tables in schema:`);
    tables.forEach(table => {
      console.log(`  - ${table.tableName} (${table.exportName})`);
    });
    
    return tables;
  } catch (error) {
    console.error('❌ Error reading schema file:', error.message);
    process.exit(1);
  }
}

/**
 * Generate test template for a table
 */
function generateTestTemplate(table) {
  const { tableName, exportName } = table;
  
  return `describe('${tableName} Table Tests', () => {
  beforeEach(() => {
    // Setup: Visit the application and ensure proper authentication
    cy.visit('/');
    // Add any necessary authentication steps here
  });

  describe('Database Operations', () => {
    it('should handle ${tableName} CRUD operations', () => {
      // TODO: Implement ${tableName} creation test
      cy.log('Testing ${tableName} creation');
      
      // This test should fail until implemented
      expect(false, 'IMPLEMENT: ${tableName} creation test').to.be.true;
    });

    it('should validate ${tableName} data integrity', () => {
      // TODO: Implement ${tableName} validation test
      cy.log('Testing ${tableName} data validation');
      
      // This test should fail until implemented
      expect(false, 'IMPLEMENT: ${tableName} validation test').to.be.true;
    });

    it('should handle ${tableName} relationships correctly', () => {
      // TODO: Implement ${tableName} relationship test
      cy.log('Testing ${tableName} foreign key relationships');
      
      // This test should fail until implemented
      expect(false, 'IMPLEMENT: ${tableName} relationship test').to.be.true;
    });
  });

  describe('API Endpoints', () => {
    it('should test ${tableName} API endpoints', () => {
      // TODO: Test API endpoints for ${tableName}
      cy.log('Testing ${tableName} API endpoints');
      
      // Example API tests (uncomment and modify as needed):
      // cy.request('GET', '/api/${tableName}').then((response) => {
      //   expect(response.status).to.eq(200);
      // });
      
      // This test should fail until implemented
      expect(false, 'IMPLEMENT: ${tableName} API endpoint tests').to.be.true;
    });
  });

  describe('UI Integration', () => {
    it('should test ${tableName} UI components', () => {
      // TODO: Test UI components that interact with ${tableName}
      cy.log('Testing ${tableName} UI integration');
      
      // This test should fail until implemented
      expect(false, 'IMPLEMENT: ${tableName} UI integration test').to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle ${tableName} errors gracefully', () => {
      // TODO: Test error scenarios for ${tableName}
      cy.log('Testing ${tableName} error handling');
      
      // This test should fail until implemented
      expect(false, 'IMPLEMENT: ${tableName} error handling test').to.be.true;
    });
  });
});

/*
 * Table Schema Reference for ${tableName}:
 * Export name: ${exportName}
 * 
 * TODO: Add specific field tests based on your schema:
 * - Test required fields
 * - Test field validation
 * - Test default values
 * - Test foreign key constraints
 * - Test unique constraints
 * 
 * Example field tests:
 * it('should validate required fields', () => {
 *   // Test that required fields are enforced
 * });
 * 
 * it('should handle UUID generation', () => {
 *   // Test UUID primary key generation
 * });
 * 
 * it('should validate timestamps', () => {
 *   // Test created_at and other timestamp fields
 * });
 */
`;
}

/**
 * Check if file exists and is not empty
 */
function isFileImplemented(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content.length > 0;
}

/**
 * Generate or update test files
 */
function generateTestFiles(tables) {
  if (!fs.existsSync(E2E_DIR)) {
    fs.mkdirSync(E2E_DIR, { recursive: true });
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;

  tables.forEach(table => {
    const testFilePath = path.join(E2E_DIR, table.testFileName);
    
    if (isFileImplemented(testFilePath)) {
      console.log(`⏭️  Skipping ${table.testFileName} (already implemented)`);
      skipped++;
    } else {
      const testContent = generateTestTemplate(table);
      fs.writeFileSync(testFilePath, testContent);
      
      if (fs.existsSync(testFilePath) && fs.statSync(testFilePath).size === 0) {
        console.log(`✨ Created ${table.testFileName} (was empty)`);
        updated++;
      } else {
        console.log(`📝 Created ${table.testFileName}`);
        created++;
      }
    }
  });

  return { created, skipped, updated };
}

/**
 * Generate summary report
 */
function generateSummaryReport(tables, stats) {
  const reportPath = path.join(E2E_DIR, 'table-test-coverage.md');
  
  let report = `# Database Table Test Coverage Report

Generated on: ${new Date().toISOString()}

## Summary
- **Total Tables**: ${tables.length}
- **Tests Created**: ${stats.created}
- **Tests Updated**: ${stats.updated}
- **Tests Skipped** (already implemented): ${stats.skipped}

## Table Coverage

| Table Name | Export Name | Test File | Status |
|------------|-------------|-----------|--------|
`;

  tables.forEach(table => {
    const testFilePath = path.join(E2E_DIR, table.testFileName);
    const status = isFileImplemented(testFilePath) ? '✅ Implemented' : '❌ Needs Implementation';
    
    report += `| ${table.tableName} | ${table.exportName} | ${table.testFileName} | ${status} |\n`;
  });

  report += `
## Next Steps

1. **Review failing tests**: All generated tests include failing assertions to ensure they're implemented
2. **Implement CRUD operations**: Add actual database operation tests for each table
3. **Add API endpoint tests**: Test your API routes for each table
4. **Test UI integration**: Ensure UI components work with database operations
5. **Add error handling**: Test edge cases and error scenarios

## Running Tests

\`\`\`bash
# Run all table tests
npm run test:tables

# Run specific table test
npm run cypress:run -- --spec "cypress/e2e/users.cy.ts"

# Open Cypress UI for specific table
npm run cypress:open -- --e2e --spec "cypress/e2e/users.cy.ts"
\`\`\`

## Core Tests

The following core test files are maintained separately:
`;

  // List core test files
  const coreFiles = fs.readdirSync(E2E_DIR)
    .filter(file => file.startsWith(CORE_TEST_PREFIX) && file.endsWith('.cy.ts'));
  
  coreFiles.forEach(file => {
    report += `- ${file}\n`;
  });

  fs.writeFileSync(reportPath, report);
  console.log(`📋 Generated coverage report: ${reportPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating Cypress tests for database tables...\n');
  
  const tables = extractTableNames();
  
  if (tables.length === 0) {
    console.log('⚠️  No tables found in schema file');
    return;
  }
  
  console.log('\n📁 Generating test files...');
  const stats = generateTestFiles(tables);
  
  console.log('\n📊 Summary:');
  console.log(`  ✨ Created: ${stats.created} files`);
  console.log(`  🔄 Updated: ${stats.updated} files`);
  console.log(`  ⏭️  Skipped: ${stats.skipped} files`);
  
  generateSummaryReport(tables, stats);
  
  console.log('\n✅ Test generation complete!');
  console.log('💡 Run "npm run test:tables" to execute all table tests');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { extractTableNames, generateTestFiles, generateSummaryReport }; 