#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path configurations
const SCHEMA_PATH = path.join(__dirname, '../drizzle/schema.ts');
const QUERIES_DIR = path.join(__dirname, '../utils/queries');
const MUTATIONS_DIR = path.join(__dirname, '../utils/mutations');

/**
 * Extract detailed table information including relationships
 */
function extractTableInfo() {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    // Extract tables with their relationships
    const tableRegex = /export const (\w+)\s*=\s*pgTable\(\s*"([^"]+)"\s*,\s*\{([\s\S]*?)\}\s*,\s*\(table\)\s*=>\s*\[([\s\S]*?)\]\s*\)/g;
    const tables = [];
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(schemaContent)) !== null) {
      const [, exportName, tableName, fieldsContent, constraintsContent] = tableMatch;
      
      // Parse fields
      const fields = parseFields(fieldsContent);
      
      // Parse foreign key relationships
      const foreignKeys = constraintsContent ? parseForeignKeys(constraintsContent) : [];
      
      tables.push({
        exportName,
        tableName,
        singularName: getSingularName(exportName),
        fields,
        foreignKeys,
        primaryKey: fields.find(f => f.isPrimaryKey)?.name || 'id'
      });
    }
    
    return tables;
  } catch (error) {
    console.error('❌ Error parsing schema:', error.message);
    process.exit(1);
  }
}

/**
 * Parse field definitions
 */
function parseFields(fieldsContent) {
  const fields = [];
  const fieldLines = fieldsContent.split(',').map(line => line.trim()).filter(line => line);
  
  fieldLines.forEach(line => {
    const fieldMatch = line.match(/(\w+):\s*([^,]+)/);
    if (fieldMatch) {
      const [, fieldName, fieldDef] = fieldMatch;
      
      fields.push({
        name: fieldName,
        definition: fieldDef.trim(),
        type: extractFieldType(fieldDef),
        isRequired: fieldDef.includes('.notNull()'),
        isPrimaryKey: fieldDef.includes('.primaryKey()'),
        isUnique: fieldDef.includes('.unique()'),
        hasDefault: fieldDef.includes('.default('),
        isForeignKey: fieldName.endsWith('Id') || fieldName.endsWith('Ids') || fieldName.includes('_id')
      });
    }
  });
  
  return fields;
}

/**
 * Parse foreign key constraints
 */
function parseForeignKeys(constraintsContent) {
  const foreignKeys = [];
  
  const fkMatches = constraintsContent.matchAll(
    /foreignKey\(\s*\{[\s\S]*?columns:\s*\[([^\]]+?)\][\s\S]*?foreignColumns:\s*\[([^\]]+?)\][\s\S]*?name:\s*"([^"]+)"[\s\S]*?\}\)\s*(?:\.\w+\([^)]*\))*/g
  );
  
  for (const match of fkMatches) {
    const [, columns, foreignColumns, name] = match;
    const columnName = columns.split(',')[0].trim().replace(/table\./, '');
    const foreignTable = name.split('_')[0]; // Extract table name from constraint name
    
    foreignKeys.push({
      columnName,
      foreignTable,
      name
    });
  }
  
  return foreignKeys;
}

/**
 * Extract field type
 */
function extractFieldType(fieldDef) {
  if (fieldDef.includes('uuid(')) return 'string';
  if (fieldDef.includes('text(')) return 'string';
  if (fieldDef.includes('integer(')) return 'number';
  if (fieldDef.includes('boolean(')) return 'boolean';
  if (fieldDef.includes('timestamp(')) return 'string';
  if (fieldDef.includes('pgEnum')) return 'string';
  if (fieldDef.includes('.array()')) return 'string[]';
  return 'any';
}

/**
 * Get singular name from plural table name
 */
function getSingularName(tableName) {
  if (tableName.endsWith('ies')) return tableName.slice(0, -3) + 'y';
  if (tableName.endsWith('ses') || tableName.endsWith('ches')) return tableName.slice(0, -2);
  if (tableName.endsWith('s')) return tableName.slice(0, -1);
  return tableName;
}

/**
 * Generate query files
 */
function generateQueries(tables) {
  console.log('📖 Generating query files...\n');
  
  if (!fs.existsSync(QUERIES_DIR)) {
    fs.mkdirSync(QUERIES_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  tables.forEach(table => {
    const { exportName, tableName, singularName, fields, foreignKeys, primaryKey } = table;
    
    // Create table-specific directory
    const tableDir = path.join(QUERIES_DIR, tableName);
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }
    
    // 1. Get all items
    const getAllQuery = generateGetAllQuery(exportName, tableName);
    writeQueryFile(tableName, `get-all-${tableName.replace(/_/g, '-')}.ts`, getAllQuery, created, updated);
    
    // 2. Get single item by ID
    const getByIdQuery = generateGetByIdQuery(exportName, tableName, singularName, primaryKey);
    writeQueryFile(tableName, `get-${singularName.replace(/_/g, '-')}.ts`, getByIdQuery, created, updated);
    
    // 3. Get items by foreign key relationships (singular)
    foreignKeys.forEach(fk => {
      const getByFkQuery = generateGetByForeignKeyQuery(exportName, tableName, fk);
      writeQueryFile(tableName, `get-${tableName.replace(/_/g, '-')}-by-${fk.columnName.replace(/Id$/, '').replace(/_/g, '-')}.ts`, getByFkQuery, created, updated);
    });
    
    // 4. Get items by foreign key relationships (plural)
    foreignKeys.forEach(fk => {
      const getByFkPluralQuery = generateGetByForeignKeyPluralQuery(exportName, tableName, fk);
      const paramName = fk.columnName.replace(/Id$/, '').replace(/_/g, '');
      const pluralParamName = paramName.endsWith('s') ? paramName : paramName + 's';
      writeQueryFile(tableName, `get-${tableName.replace(/_/g, '-')}-by-${pluralParamName.replace(/_/g, '-')}.ts`, getByFkPluralQuery, created, updated);
    });
  });

  console.log(`📖 Query generation complete: ${created} created, ${updated} updated`);
}

/**
 * Generate mutation files
 */
function generateMutations(tables) {
  console.log('✏️  Generating mutation files...\n');
  
  if (!fs.existsSync(MUTATIONS_DIR)) {
    fs.mkdirSync(MUTATIONS_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  tables.forEach(table => {
    const { exportName, tableName, singularName, fields, primaryKey } = table;
    
    // Create table-specific directory
    const tableDir = path.join(MUTATIONS_DIR, tableName);
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }
    
    // 1. Create single
    const createMutation = generateCreateMutation(exportName, tableName, singularName, fields);
    writeMutationFile(tableName, `create-${singularName.replace(/_/g, '-')}.ts`, createMutation, created, updated);
    
    // 2. Create multiple
    const createMultipleMutation = generateCreateMultipleMutation(exportName, tableName, singularName, fields);
    writeMutationFile(tableName, `create-${tableName.replace(/_/g, '-')}.ts`, createMultipleMutation, created, updated);
    
    // 3. Update single
    const updateMutation = generateUpdateMutation(exportName, tableName, singularName, fields, primaryKey);
    writeMutationFile(tableName, `update-${singularName.replace(/_/g, '-')}.ts`, updateMutation, created, updated);
    
    // 4. Update multiple
    const updateMultipleMutation = generateUpdateMultipleMutation(exportName, tableName, singularName, fields, primaryKey);
    writeMutationFile(tableName, `update-${tableName.replace(/_/g, '-')}.ts`, updateMultipleMutation, created, updated);
    
    // 5. Delete single
    const deleteMutation = generateDeleteMutation(exportName, tableName, singularName, primaryKey);
    writeMutationFile(tableName, `delete-${singularName.replace(/_/g, '-')}.ts`, deleteMutation, created, updated);
    
    // 6. Delete multiple
    const deleteMultipleMutation = generateDeleteMultipleMutation(exportName, tableName, singularName, primaryKey);
    writeMutationFile(tableName, `delete-${tableName.replace(/_/g, '-')}.ts`, deleteMultipleMutation, created, updated);
  });

  console.log(`✏️  Mutation generation complete: ${created} created, ${updated} updated`);
}

/**
 * Generate get all query
 */
function generateGetAllQuery(exportName, tableName) {
  return `// utils/queries/${tableName}/get-all-${tableName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";

export async function getAll${capitalize(exportName)}() {
  try {
    return await db.select().from(${exportName});
  } catch (error) {
    console.error("Error fetching all ${tableName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate get by ID query
 */
function generateGetByIdQuery(exportName, tableName, singularName, primaryKey) {
  return `// utils/queries/${tableName}/get-${singularName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function get${capitalize(singularName)}(${primaryKey}: string) {
  try {
    const result = await db.select().from(${exportName}).where(eq(${exportName}.${primaryKey}, ${primaryKey}));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching ${singularName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate get by foreign key query
 */
function generateGetByForeignKeyQuery(exportName, tableName, foreignKey) {
  const paramName = foreignKey.columnName.replace(/Id$/, '').replace(/_/g, '');
  return `// utils/queries/${tableName}/get-${tableName.replace(/_/g, '-')}-by-${paramName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function get${capitalize(exportName)}By${capitalize(paramName)}(${paramName}Id: string) {
  try {
    return await db.select().from(${exportName}).where(eq(${exportName}.${foreignKey.columnName}, ${paramName}Id));
  } catch (error) {
    console.error("Error fetching ${tableName} by ${paramName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate get by foreign key query (plural version)
 */
function generateGetByForeignKeyPluralQuery(exportName, tableName, foreignKey) {
  const paramName = foreignKey.columnName.replace(/Id$/, '').replace(/_/g, '');
  const pluralParamName = paramName.endsWith('s') ? paramName : paramName + 's';
  return `// utils/queries/${tableName}/get-${tableName.replace(/_/g, '-')}-by-${pluralParamName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function get${capitalize(exportName)}By${capitalize(pluralParamName)}(${paramName}Ids: string[]) {
  try {
    return await db.select().from(${exportName}).where(inArray(${exportName}.${foreignKey.columnName}, ${paramName}Ids));
  } catch (error) {
    console.error("Error fetching ${tableName} by ${pluralParamName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate create mutation
 */
function generateCreateMutation(exportName, tableName, singularName, fields) {
  return `// utils/mutations/${tableName}/create-${singularName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";

export async function create${capitalize(singularName)}(data: typeof ${exportName}.$inferInsert) {
  try {
    const result = await db.insert(${exportName}).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating ${singularName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate create multiple mutation
 */
function generateCreateMultipleMutation(exportName, tableName, singularName, fields) {
  return `// utils/mutations/${tableName}/create-${tableName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";

export async function create${capitalize(exportName)}(data: (typeof ${exportName}.$inferInsert)[]) {
  try {
    return await db.insert(${exportName}).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple ${tableName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate update mutation
 */
function generateUpdateMutation(exportName, tableName, singularName, fields, primaryKey) {
  return `// utils/mutations/${tableName}/update-${singularName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function update${capitalize(singularName)}(${primaryKey}: string, data: Partial<typeof ${exportName}.$inferInsert>) {
  try {
    const result = await db.update(${exportName}).set(data).where(eq(${exportName}.${primaryKey}, ${primaryKey})).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating ${singularName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate update multiple mutation
 */
function generateUpdateMultipleMutation(exportName, tableName, singularName, fields, primaryKey) {
  return `// utils/mutations/${tableName}/update-${tableName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function update${capitalize(exportName)}(${primaryKey}s: string[], data: Partial<typeof ${exportName}.$inferInsert>) {
  try {
    return await db.update(${exportName}).set(data).where(inArray(${exportName}.${primaryKey}, ${primaryKey}s)).returning();
  } catch (error) {
    console.error("Error updating multiple ${tableName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate delete mutation
 */
function generateDeleteMutation(exportName, tableName, singularName, primaryKey) {
  return `// utils/mutations/${tableName}/delete-${singularName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function delete${capitalize(singularName)}(${primaryKey}: string) {
  try {
    const result = await db.delete(${exportName}).where(eq(${exportName}.${primaryKey}, ${primaryKey})).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting ${singularName}:", error);
    throw error;
  }
}
`;
}

/**
 * Generate delete multiple mutation
 */
function generateDeleteMultipleMutation(exportName, tableName, singularName, primaryKey) {
  return `// utils/mutations/${tableName}/delete-${tableName.replace(/_/g, '-')}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function delete${capitalize(exportName)}(${primaryKey}s: string[]) {
  try {
    return await db.delete(${exportName}).where(inArray(${exportName}.${primaryKey}, ${primaryKey}s)).returning();
  } catch (error) {
    console.error("Error deleting multiple ${tableName}:", error);
    throw error;
  }
}
`;
}

/**
 * Write query file
 */
function writeQueryFile(tableName, filename, content, created, updated) {
  const filePath = path.join(QUERIES_DIR, tableName, filename);
  const exists = fs.existsSync(filePath);
  
  fs.writeFileSync(filePath, content);
  
  if (exists) {
    updated++;
    console.log(`🔄 Updated ${tableName}/${filename}`);
  } else {
    created++;
    console.log(`📝 Created ${tableName}/${filename}`);
  }
}

/**
 * Write mutation file
 */
function writeMutationFile(tableName, filename, content, created, updated) {
  const filePath = path.join(MUTATIONS_DIR, tableName, filename);
  const exists = fs.existsSync(filePath);
  
  fs.writeFileSync(filePath, content);
  
  if (exists) {
    updated++;
    console.log(`🔄 Updated ${tableName}/${filename}`);
  } else {
    created++;
    console.log(`📝 Created ${tableName}/${filename}`);
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Main generation function
 */
function generateQueriesAndMutations() {
  console.log('🚀 Generating queries and mutations from Drizzle schema...\n');
  
  const tables = extractTableInfo();
  
  console.log(`📊 Found ${tables.length} tables:`);
  tables.forEach(table => {
    console.log(`  - ${table.exportName} (${table.foreignKeys.length} foreign keys)`);
  });
  console.log('');
  
  generateQueries(tables);
  console.log('');
  generateMutations(tables);
  
  console.log('\n✅ Generation complete!');
  console.log('📁 Check utils/queries/ and utils/mutations/ directories');
}

// Run if called directly
if (require.main === module) {
  generateQueriesAndMutations();
}

module.exports = { generateQueriesAndMutations, extractTableInfo }; 