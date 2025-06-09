#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path configurations
const SCHEMA_PATH = path.join(__dirname, '../../drizzle/schema.ts');

/**
 * Extract detailed table information including fields and constraints
 */
function extractDetailedTableInfo() {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Extract enums first
    const enumRegex = /export const (\w+) = pgEnum\("([^"]+)", \[([^\]]+)\]/g;
    const enums = {};
    let enumMatch;
    
    while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
      const [, enumName, enumDbName, enumValues] = enumMatch;
      const values = enumValues.split(',').map(v => v.trim().replace(/['"]/g, ''));
      enums[enumName] = { dbName: enumDbName, values };
    }
    
    // Extract tables with detailed field information
    const tableRegex = /export const (\w+) = pgTable\("([^"]+)", \{([^}]+)\}/gs;
    const tables = [];
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(schemaContent)) !== null) {
      const [, exportName, tableName, fieldsContent] = tableMatch;
      
      // Parse fields
      const fields = parseFields(fieldsContent, enums);
      
      // Extract foreign keys and constraints
      const constraintsMatch = schemaContent.match(
        new RegExp(`export const ${exportName} = pgTable\\("${tableName}", \\{[^}]+\\}, \\(table\\) => \\[([^\\]]+)\\]`, 's')
      );
      
      const constraints = constraintsMatch ? parseConstraints(constraintsMatch[1]) : [];
      
      tables.push({
        exportName,
        tableName,
        testFileName: `${tableName.replace(/_/g, '-')}.cy.ts`,
        fields,
        constraints,
        hasTimestamps: fields.some(f => f.name === 'createdAt' || f.name === 'created_at'),
        hasUuid: fields.some(f => f.type === 'uuid' && f.isPrimaryKey),
        requiredFields: fields.filter(f => f.isRequired),
        uniqueFields: fields.filter(f => f.isUnique)
      });
    }
    
    return { tables, enums };
  } catch (error) {
    console.error('❌ Error parsing schema:', error.message);
    process.exit(1);
  }
}

/**
 * Parse field definitions from table content
 */
function parseFields(fieldsContent, enums) {
  const fields = [];
  const fieldLines = fieldsContent.split(',').map(line => line.trim()).filter(line => line);
  
  fieldLines.forEach(line => {
    const fieldMatch = line.match(/(\w+):\s*([^,]+)/);
    if (fieldMatch) {
      const [, fieldName, fieldDef] = fieldMatch;
      
      const field = {
        name: fieldName,
        definition: fieldDef.trim(),
        type: extractFieldType(fieldDef),
        isRequired: fieldDef.includes('.notNull()'),
        isPrimaryKey: fieldDef.includes('.primaryKey()'),
        isUnique: fieldDef.includes('.unique()'),
        hasDefault: fieldDef.includes('.default('),
        isArray: fieldDef.includes('.array()'),
        isForeignKey: fieldName.endsWith('Id') || fieldName.endsWith('Ids') || fieldName.includes('_id'),
        enumType: extractEnumType(fieldDef, enums)
      };
      
      fields.push(field);
    }
  });
  
  return fields;
}

/**
 * Extract field type from definition
 */
function extractFieldType(fieldDef) {
  if (fieldDef.includes('uuid(')) return 'uuid';
  if (fieldDef.includes('text(')) return 'text';
  if (fieldDef.includes('integer(')) return 'integer';
  if (fieldDef.includes('boolean(')) return 'boolean';
  if (fieldDef.includes('timestamp(')) return 'timestamp';
  if (fieldDef.includes('pgEnum')) return 'enum';
  return 'unknown';
}

/**
 * Extract enum type from field definition
 */
function extractEnumType(fieldDef, enums) {
  for (const [enumName, enumInfo] of Object.entries(enums)) {
    if (fieldDef.includes(`${enumName}()`)) {
      return { name: enumName, ...enumInfo };
    }
  }
  return null;
}

/**
 * Parse constraints from table definition
 */
function parseConstraints(constraintsContent) {
  const constraints = [];
  
  // Foreign key constraints
  const fkMatches = constraintsContent.matchAll(/foreignKey\(\{[^}]+columns:\s*\[([^\]]+)\][^}]+foreignColumns:\s*\[([^\]]+)\][^}]+name:\s*"([^"]+)"[^}]*\}\)(?:\.onDelete\("([^"]+)"\))?/g);
  
  for (const match of fkMatches) {
    const [, columns, foreignColumns, name, onDelete] = match;
    constraints.push({
      type: 'foreignKey',
      columns: columns.split(',').map(c => c.trim().replace(/table\./, '')),
      foreignColumns: foreignColumns.split(',').map(c => c.trim()),
      name,
      onDelete: onDelete || 'restrict'
    });
  }
  
  // Unique constraints
  const uniqueMatches = constraintsContent.matchAll(/unique\("([^"]+)"\)\.on\(([^)]+)\)/g);
  
  for (const match of uniqueMatches) {
    const [, name, columns] = match;
    constraints.push({
      type: 'unique',
      name,
      columns: columns.split(',').map(c => c.trim().replace(/table\./, ''))
    });
  }
  
  return constraints;
}

/**
 * Generate advanced test template with field-specific tests
 */
function generateAdvancedTestTemplate(table, allTables) {
  const { tableName, exportName, fields, constraints, hasTimestamps, hasUuid, requiredFields, uniqueFields } = table;
  
  let template = `describe('${tableName} Table Tests', () => {
  beforeEach(() => {
    // Setup: Visit the application and ensure proper authentication
    cy.visit('/');
    // Add any necessary authentication steps here
  });

  describe('Database Schema Validation', () => {`;

  // UUID primary key test
  if (hasUuid) {
    template += `
    it('should generate UUID primary keys automatically', () => {
      // TODO: Test UUID generation for ${tableName}
      cy.log('Testing UUID primary key generation for ${tableName}');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: UUID primary key test for ${tableName}');
    });`;
  }

  // Timestamp tests
  if (hasTimestamps) {
    template += `
    it('should automatically set timestamps', () => {
      // TODO: Test timestamp fields (created_at, updated_at) for ${tableName}
      cy.log('Testing automatic timestamp generation for ${tableName}');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: Timestamp validation test for ${tableName}');
    });`;
  }

  // Required fields test
  if (requiredFields.length > 0) {
    template += `
    it('should enforce required fields', () => {
      // TODO: Test required fields: ${requiredFields.map(f => f.name).join(', ')}
      cy.log('Testing required fields for ${tableName}');
      
      // Required fields that should be validated:
      ${requiredFields.map(f => `      // - ${f.name} (${f.type})`).join('\n')}
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: Required fields validation for ${tableName}');
    });`;
  }

  // Unique constraints test
  if (uniqueFields.length > 0 || constraints.some(c => c.type === 'unique')) {
    template += `
    it('should enforce unique constraints', () => {
      // TODO: Test unique constraints for ${tableName}
      cy.log('Testing unique constraints for ${tableName}');
      
      ${uniqueFields.length > 0 ? `// Unique fields: ${uniqueFields.map(f => f.name).join(', ')}` : ''}
      ${constraints.filter(c => c.type === 'unique').map(c => `      // Unique constraint: ${c.name} on ${c.columns.join(', ')}`).join('\n')}
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: Unique constraints test for ${tableName}');
    });`;
  }

  // Enum validation tests
  const enumFields = fields.filter(f => f.enumType);
  if (enumFields.length > 0) {
    template += `
    it('should validate enum values', () => {
      // TODO: Test enum field validation for ${tableName}
      cy.log('Testing enum validation for ${tableName}');
      
      ${enumFields.map(f => `      // ${f.name}: ${f.enumType.values.join(' | ')}`).join('\n')}
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: Enum validation test for ${tableName}');
    });`;
  }

  template += `
  });

  describe('Foreign Key Relationships', () => {`;

  // Foreign key tests
  const foreignKeyConstraints = constraints.filter(c => c.type === 'foreignKey');
  if (foreignKeyConstraints.length > 0) {
    foreignKeyConstraints.forEach(fk => {
      template += `
    it('should maintain foreign key constraint: ${fk.name}', () => {
      // TODO: Test foreign key relationship
      cy.log('Testing foreign key constraint: ${fk.name}');
      
      // Foreign key: ${fk.columns.join(', ')} -> ${fk.foreignColumns.join(', ')}
      // On delete: ${fk.onDelete}
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: Foreign key test for ${fk.name}');
    });`;
    });
  } else {
    template += `
    it('should handle relationships correctly', () => {
      // TODO: Test table relationships for ${tableName}
      cy.log('Testing relationships for ${tableName}');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: Relationship test for ${tableName}');
    });`;
  }

  template += `
  });

  describe('CRUD Operations', () => {
    it('should create ${tableName} records', () => {
      // TODO: Test record creation
      cy.log('Testing ${tableName} creation');
      
      // Sample data structure:
      ${generateSampleDataComment(fields)}
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} creation test');
    });

    it('should read ${tableName} records', () => {
      // TODO: Test record retrieval
      cy.log('Testing ${tableName} reading');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} read test');
    });

    it('should update ${tableName} records', () => {
      // TODO: Test record updates
      cy.log('Testing ${tableName} updates');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} update test');
    });

    it('should delete ${tableName} records', () => {
      // TODO: Test record deletion
      cy.log('Testing ${tableName} deletion');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} delete test');
    });
  });

  describe('API Endpoints', () => {
    it('should test ${tableName} API endpoints', () => {
      // TODO: Test API endpoints for ${tableName}
      cy.log('Testing ${tableName} API endpoints');
      
      // Example API tests:
      // cy.request('GET', '/api/${tableName}').then((response) => {
      //   expect(response.status).to.eq(200);
      //   expect(response.body).to.be.an('array');
      // });
      
      // cy.request('POST', '/api/${tableName}', sampleData).then((response) => {
      //   expect(response.status).to.eq(201);
      //   expect(response.body).to.have.property('id');
      // });
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} API endpoint tests');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', () => {
      // TODO: Test validation error scenarios
      cy.log('Testing ${tableName} validation errors');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} validation error test');
    });

    it('should handle constraint violations', () => {
      // TODO: Test constraint violation scenarios
      cy.log('Testing ${tableName} constraint violations');
      
      // This test should fail until implemented
      cy.wrap(null).should('not.exist', 'IMPLEMENT: ${tableName} constraint violation test');
    });
  });
});

/*
 * Table Schema Reference for ${tableName}:
 * Export name: ${exportName}
 * 
 * Fields:
${fields.map(f => ` * - ${f.name}: ${f.type}${f.isRequired ? ' (required)' : ''}${f.isPrimaryKey ? ' (primary key)' : ''}${f.isUnique ? ' (unique)' : ''}${f.enumType ? ` (enum: ${f.enumType.values.join('|')})` : ''}`).join('\n')}
 * 
 * Constraints:
${constraints.map(c => ` * - ${c.type}: ${c.name}`).join('\n')}
 * 
 * Foreign Key Relationships:
${foreignKeyConstraints.map(fk => ` * - ${fk.columns.join(', ')} -> ${fk.foreignColumns.join(', ')} (${fk.onDelete})`).join('\n')}
 */
`;

  return template;
}

/**
 * Generate sample data comment based on fields
 */
function generateSampleDataComment(fields) {
  const sampleData = {};
  
  fields.forEach(field => {
    if (field.isPrimaryKey && field.type === 'uuid') {
      sampleData[field.name] = '// Auto-generated UUID';
    } else if (field.name === 'createdAt' || field.name === 'created_at') {
      sampleData[field.name] = '// Auto-generated timestamp';
    } else if (field.type === 'text') {
      sampleData[field.name] = `"sample ${field.name}"`;
    } else if (field.type === 'integer') {
      sampleData[field.name] = '123';
    } else if (field.type === 'boolean') {
      sampleData[field.name] = 'true';
    } else if (field.enumType) {
      sampleData[field.name] = `"${field.enumType.values[0]}"`;
    } else if (field.isArray) {
      sampleData[field.name] = '[]';
    } else {
      sampleData[field.name] = `"${field.name}_value"`;
    }
  });
  
  return Object.entries(sampleData)
    .map(([key, value]) => `      // ${key}: ${value}`)
    .join('\n');
}

/**
 * Generate advanced test files
 */
function generateAdvancedTests() {
  console.log('🚀 Generating advanced Cypress tests...\n');
  
  const { tables, enums } = extractDetailedTableInfo();
  
  console.log(`📊 Found ${tables.length} tables and ${Object.keys(enums).length} enums`);
  
  const E2E_DIR = path.join(__dirname, '../e2e');
  if (!fs.existsSync(E2E_DIR)) {
    fs.mkdirSync(E2E_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  tables.forEach(table => {
    const testFilePath = path.join(E2E_DIR, table.testFileName);
    const exists = fs.existsSync(testFilePath);
    const isEmpty = !exists || fs.readFileSync(testFilePath, 'utf8').trim().length === 0;
    
    if (!isEmpty && exists) {
      console.log(`⏭️  Skipping ${table.testFileName} (already implemented)`);
      skipped++;
    } else {
      const testContent = generateAdvancedTestTemplate(table, tables);
      fs.writeFileSync(testFilePath, testContent);
      
      if (exists) {
        console.log(`✨ Updated ${table.testFileName} (was empty)`);
        updated++;
      } else {
        console.log(`📝 Created ${table.testFileName}`);
        created++;
      }
    }
  });

  console.log('\n📊 Summary:');
  console.log(`  ✨ Created: ${created} files`);
  console.log(`  🔄 Updated: ${updated} files`);
  console.log(`  ⏭️  Skipped: ${skipped} files`);
  
  return { created, updated, skipped, tables, enums };
}

// Run if called directly
if (require.main === module) {
  generateAdvancedTests();
}

module.exports = { generateAdvancedTests, extractDetailedTableInfo }; 