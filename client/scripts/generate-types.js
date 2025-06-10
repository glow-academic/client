#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path configurations
const SCHEMA_PATH = path.join(__dirname, '../drizzle/schema.ts');
const TYPES_PATH = path.join(__dirname, '../types.ts');

/**
 * Extract table and enum information from schema
 */
function extractSchemaInfo() {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Extract table exports
    const tableRegex = /export const (\w+) = pgTable\(/g;
    const tables = [];
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(schemaContent)) !== null) {
      tables.push(tableMatch[1]);
    }
    
    // Extract enum exports
    const enumRegex = /export const (\w+) = pgEnum\(/g;
    const enums = [];
    let enumMatch;
    
    while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
      enums.push(enumMatch[1]);
    }
    
    return { tables, enums };
  } catch (error) {
    console.error('❌ Error parsing schema:', error.message);
    process.exit(1);
  }
}

/**
 * Convert plural table names to singular type names
 */
function singularize(word) {
  // Handle special cases that don't follow simple rules
  const specialCases = {
    'classes': 'class'
  };
  
  if (specialCases[word.toLowerCase()]) {
    return specialCases[word.toLowerCase()];
  }
  
  // For most cases, just remove the 's' at the end
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  
  // Return as-is if no pattern matches
  return word;
}

/**
 * Generate types.ts content
 */
function generateTypesContent(tables, enums) {
  // Generate imports - keep original table names for imports
  const tableImports = tables.map(table => `${table} as ${capitalize(table)}`).join(',\n  ');
  const enumImports = enums.join(', ');
  
  const imports = `import { 
  ${tableImports},
  ${enumImports}
} from "@/drizzle/schema";`;

  // Generate table types with singular names
  const tableTypes = tables.map(table => {
    const singularName = capitalize(singularize(table));
    return `type ${singularName} = typeof ${capitalize(table)}.$inferSelect;`;
  }).join('\n');

  // Generate enum types
  const enumTypes = enums.map(enumName => 
    `type ${capitalize(enumName)} = (typeof ${enumName}.enumValues)[number];`
  ).join('\n');

  // Generate exports with singular names
  const tableExports = tables.map(table => capitalize(singularize(table))).join(',\n  ');
  const enumExports = enums.map(enumName => capitalize(enumName)).join(',\n  ');
  
  const exports = `export type { 
  ${tableExports},
  ${enumExports}
};`;

  return `${imports}

// Use Drizzle schema types
${tableTypes}

${enumTypes}

${exports}
`;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate types file
 */
function generateTypes() {
  console.log('🚀 Generating types from Drizzle schema...\n');
  
  const { tables, enums } = extractSchemaInfo();
  
  console.log(`📊 Found ${tables.length} tables and ${enums.length} enums`);
  console.log(`📋 Tables: ${tables.join(', ')}`);
  console.log(`🏷️  Enums: ${enums.join(', ')}`);
  
  const typesContent = generateTypesContent(tables, enums);
  
  // Write the types file
  fs.writeFileSync(TYPES_PATH, typesContent);
  
  console.log(`\n✅ Generated ${TYPES_PATH}`);
  console.log('📝 All table and enum types are now available with singular names!');
}

// Run if called directly
if (require.main === module) {
  generateTypes();
}

module.exports = { generateTypes, extractSchemaInfo }; 