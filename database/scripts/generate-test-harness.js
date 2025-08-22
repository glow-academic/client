#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const SCHEMA_PATH = path.join(__dirname, "../drizzle/schema.ts");
const CLIENT_LIB_DIR = path.join(__dirname, "../../client/lib");
const CLIENT_TEST_DIR = path.join(__dirname, "../../client/test");
const CLIENT_MOCKS_DIR = path.join(__dirname, "../../client/mocks");
const CLIENT_QUERIES_DIR = path.join(__dirname, "../../client/utils/queries");
const CLIENT_MUTATIONS_DIR = path.join(
  __dirname,
  "../../client/utils/mutations"
);
const CLIENT_TYPES_PATH = path.join(__dirname, "../../client/types.ts");

// Add a list of tables to ignore during generation.
// These are the variable names from your schema.ts file.
const TABLES_TO_IGNORE = ["users", "accounts", "sessions", "verificationToken"];

// Non-destructive write flags for BFF generation
const FORCE_ROUTES = process.argv.includes("--force-routes");
const FORCE_HOOKS = process.argv.includes("--force-hooks");
const BACKUP_ON_FORCE = true;

function writeFileSmart(filePath, content, force = false) {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    return { created: true, updated: false, skipped: false };
  }
  if (!force) return { created: false, updated: false, skipped: true };
  if (BACKUP_ON_FORCE) {
    const bak = `${filePath}.${Date.now()}.bak`;
    fs.copyFileSync(filePath, bak);
  }
  fs.writeFileSync(filePath, content);
  return { created: false, updated: true, skipped: false };
}

// Function to get the latest snapshot file
function getLatestSnapshotPath() {
  const metaDir = path.join(__dirname, "../drizzle/meta");
  const files = fs
    .readdirSync(metaDir)
    .filter((file) => file.endsWith("_snapshot.json"))
    .sort()
    .reverse(); // Get the latest one

  if (files.length === 0) {
    throw new Error("No snapshot files found");
  }

  return path.join(metaDir, files[0]);
}

/**
 * Generate fresh snapshot using drizzle-kit introspect
 */
function generateSnapshot() {
  try {
    console.log("🔄 Generating fresh schema snapshot from database...");

    // First, pull the latest schema from the database
    execSync("npx drizzle-kit introspect", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });

    console.log("✅ Schema snapshot generated successfully from database\n");
  } catch (error) {
    console.error("❌ Error generating snapshot from database:", error.message);
    console.log("📝 Falling back to existing snapshot if available...\n");
  }
}

/**
 * Generate fresh snapshot from current schema (for schema-first approach)
 */
function generateSnapshotFromSchema() {
  try {
    console.log("🔄 Generating fresh snapshot from schema file...");

    // Generate snapshot from schema file
    execSync("npx drizzle-kit generate", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });

    console.log("✅ Schema snapshot generated successfully from schema file\n");
  } catch (error) {
    console.error("❌ Error generating snapshot from schema:", error.message);
    console.log("📝 Falling back to existing snapshot if available...\n");
  }
}

/**
 * Pull latest schema from database and generate snapshot
 */
function pullAndGenerateSnapshot() {
  try {
    console.log("🔄 Pulling latest schema from database...");

    // Pull the latest schema from the database
    execSync("npx drizzle-kit pull", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });

    console.log("✅ Latest schema pulled from database successfully\n");
  } catch (error) {
    console.error("❌ Error pulling from database:", error.message);
    console.log("📝 Trying introspect instead...\n");

    // Fallback to introspect
    generateSnapshot();
  }
}

/**
 * Detect potential schema mismatches between schema file and database
 */
function detectSchemaMismatches(snapshot) {
  const warnings = [];
  const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

  // Extract table definitions from schema
  const schemaTableRegex =
    /export const (\w+)\s*=\s*pgTable\(\s*["']([^"']+)["']/g;
  const schemaTables = new Map();
  let match;

  while ((match = schemaTableRegex.exec(schemaContent)) !== null) {
    const [, exportName, tableName] = match;
    schemaTables.set(tableName, exportName);
  }

  // Check for mismatches
  Object.entries(snapshot.tables || {}).forEach(([tableKey, tableData]) => {
    const dbTableName = tableData.name;
    const schemaExportName = schemaTables.get(dbTableName);

    if (!schemaExportName) {
      warnings.push(
        `⚠️  Table "${dbTableName}" exists in database but not found in schema file`
      );
    }
  });

  // Check for schema tables not in database
  schemaTables.forEach((exportName, tableName) => {
    const dbTable = Object.values(snapshot.tables || {}).find(
      (table) => table.name === tableName
    );
    if (!dbTable) {
      warnings.push(
        `⚠️  Table "${tableName}" (${exportName}) exists in schema but not in database`
      );
    }
  });

  if (warnings.length > 0) {
    console.log("🔍 Schema mismatch warnings:");
    warnings.forEach((warning) => console.log(`  ${warning}`));
    console.log(
      "💡 Consider running migrations or using --pull to sync with database\n"
    );
  }

  return warnings;
}

/**
 * Extract detailed table information from drizzle-kit JSON snapshot
 */
function extractTableInfo() {
  try {
    let snapshotPath;

    try {
      snapshotPath = getLatestSnapshotPath();
      console.log(`📄 Using snapshot: ${path.basename(snapshotPath)}`);
    } catch {
      console.log("📄 No snapshot found, generating one...");
      generateSnapshot();
      snapshotPath = getLatestSnapshotPath();
    }

    const snapshotContent = fs.readFileSync(snapshotPath, "utf8");
    const snapshot = JSON.parse(snapshotContent);

    // Detect potential schema mismatches
    detectSchemaMismatches(snapshot);

    const tables = [];

    // Extract tables from snapshot
    Object.entries(snapshot.tables || {}).forEach(([tableKey, tableData]) => {
      const tableName = tableData.name;
      const exportName = getExportNameFromSchema(tableName);

      // Skip processing for any table in the ignore list.
      if (TABLES_TO_IGNORE.includes(exportName)) {
        console.log(`⏭️  Ignoring table: ${exportName} (${tableName})`);
        return; // Skip this table
      }

      // Parse columns
      const fields = Object.entries(tableData.columns || {}).map(
        ([, columnData]) => ({
          name: columnData.name,
          type: mapDrizzleType(columnData.type),
          dbType: columnData.type,
          isRequired: columnData.notNull,
          isPrimaryKey: columnData.primaryKey,
          hasDefault: columnData.default !== undefined,
          isForeignKey: isForeignKeyColumn(
            columnData.name,
            tableData.foreignKeys || {}
          ),
        })
      );

      // Parse foreign keys
      const foreignKeys = Object.entries(tableData.foreignKeys || {}).map(
        ([, fkData]) => ({
          columnName: fkData.columnsFrom[0], // Taking first column for simplicity
          foreignTable: fkData.tableTo,
          name: fkData.name,
        })
      );

      // Find primary key(s) and determine type
      const primaryKeyFields = fields.filter((f) => f.isPrimaryKey);
      let primaryKey = null;
      let primaryKeyType = "string";
      let isCompositePrimaryKey = false;

      // Check for composite primary keys first
      const compositePKs = Object.values(tableData.compositePrimaryKeys || {});
      if (compositePKs.length > 0) {
        // Has composite primary key
        isCompositePrimaryKey = true;
        const compositePK = compositePKs[0]; // Take the first one
        primaryKey = compositePK.columns;
        primaryKeyType = "composite";

        // Mark the composite primary key fields as primary keys
        primaryKey.forEach((pkColumnName) => {
          const field = fields.find((f) => f.name === pkColumnName);
          if (field) {
            field.isPrimaryKey = true;
          }
        });
      } else if (primaryKeyFields.length === 0) {
        // No explicit primary key found, check if there's an 'id' column
        const idField = fields.find((f) => f.name === "id");
        if (idField) {
          primaryKey = "id";
          primaryKeyType = getPrimaryKeyType(idField.dbType);
        } else {
          // No id column found, this table might not support standard CRUD operations
          console.log(
            `⚠️  Table ${tableName} has no primary key or id column, skipping standard CRUD operations`
          );
          primaryKey = null;
          primaryKeyType = null;
        }
      } else if (primaryKeyFields.length === 1) {
        // Single primary key
        const pkField = primaryKeyFields[0];
        primaryKey = pkField.name;
        primaryKeyType = getPrimaryKeyType(pkField.dbType);
      } else {
        // Multiple primary key fields (shouldn't happen if composite keys are handled above)
        isCompositePrimaryKey = true;
        primaryKey = primaryKeyFields.map((f) => f.name);
        primaryKeyType = "composite";
      }

      tables.push({
        exportName,
        tableName,
        singularName: getSingularName(exportName),
        fields,
        foreignKeys,
        primaryKey,
        primaryKeyType,
        isCompositePrimaryKey,
      });
    });

    if (TABLES_TO_IGNORE.length > 0) console.log(""); // Add spacing for readability

    return tables;
  } catch (error) {
    console.error("❌ Error parsing snapshot:", error);
    process.exit(1);
  }
}

/**
 * Determine the TypeScript type for a primary key based on database type
 */
function getPrimaryKeyType(dbType) {
  const integerTypes = ["integer", "serial", "bigserial", "smallint", "bigint"];
  return integerTypes.includes(dbType) ? "number" : "string";
}

/**
 * Get export name from schema file for a given table name
 */
function getExportNameFromSchema(tableName) {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

    // Look for export const [name] = pgTable("tableName"
    const exportRegex = new RegExp(
      `export const (\\w+)\\s*=\\s*pgTable\\(\\s*["']${tableName}["']`,
      "g"
    );
    const match = exportRegex.exec(schemaContent);

    if (match) {
      return match[1];
    }

    // Fallback: convert table name to camelCase
    return tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  } catch {
    console.warn(
      `⚠️  Could not find export name for table ${tableName}, using fallback`
    );
    return tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}

/**
 * Map database types to TypeScript types
 */
function mapDrizzleType(dbType) {
  const typeMap = {
    uuid: "string",
    text: "string",
    varchar: "string",
    char: "string",
    integer: "number",
    serial: "number",
    bigserial: "number",
    bigint: "number",
    smallint: "number",
    numeric: "number",
    decimal: "number",
    real: "number",
    "double precision": "number",
    boolean: "boolean",
    timestamp: "string",
    "timestamp with time zone": "string",
    "timestamp without time zone": "string",
    date: "string",
    time: "string",
    json: "any",
    jsonb: "any",
  };

  // Handle array types
  if (dbType.endsWith("[]")) {
    const baseType = dbType.slice(0, -2);
    // Recursively map base type if it's a known type, otherwise default to any
    const mappedBaseType =
      typeMap[baseType] || mapDrizzleType(baseType) || "any";
    return `${mappedBaseType}[]`;
  }

  // Default to string for unknown types which could be enums
  return typeMap[dbType] || "string";
}

/**
 * Check if a column is a foreign key
 */
function isForeignKeyColumn(columnName, foreignKeys) {
  return Object.values(foreignKeys).some(
    (fk) => fk.columnsFrom && fk.columnsFrom.includes(columnName)
  );
}

/**
 * Convert any string to consistent kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2") // camelCase to kebab-case
    .replace(/_/g, "-") // snake_case to kebab-case
    .toLowerCase();
}

/**
 * Convert any string to consistent camelCase
 */
function toCamelCase(str) {
  return str
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) // snake_case to camelCase
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); // kebab-case to camelCase
}

/**
 * Convert database column name to TypeScript property name
 * e.g., "agent_id" -> "agentId", "class_id" -> "classId"
 */
function getTsPropertyName(dbColumnName) {
  // Convert snake_case to camelCase
  return toCamelCase(dbColumnName);
}

/**
 * Get singular name from plural table name
 */
function getSingularName(tableName) {
  if (tableName.endsWith("ies")) return tableName.slice(0, -3) + "y";
  if (tableName.endsWith("ses") || tableName.endsWith("ches"))
    return tableName.slice(0, -2);
  // Avoid turning 'status' into 'statu'
  if (tableName.endsWith("s") && !tableName.endsWith("ss")) {
    return tableName.slice(0, -1);
  }
  return tableName;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Creates the central mock factory file if it doesn't exist.
 */
function createMockFactoryFile() {
  const factoryDir = path.join(CLIENT_LIB_DIR, "testing");
  const factoryPath = path.join(factoryDir, "create-mockable-action.ts");

  if (fs.existsSync(factoryPath)) {
    console.log(
      "📝 Mock factory already exists at lib/testing/create-mockable-action.ts"
    );
    return;
  }

  fs.mkdirSync(factoryDir, { recursive: true });
  const factoryContent = `"use server";
// NOTE: This file must NOT be a Server Action module. Do not add "use server" here.

// An in-memory store for mocks set by Vitest.
const vitestMocks = new Map<string, () => unknown>();
export function setVitestMock(actionName: string, mockFn: () => unknown): void { 
  vitestMocks.set(actionName, mockFn); 
}
export function clearVitestMocks(): void { 
  vitestMocks.clear(); 
}

async function getMock(actionName: string): Promise<unknown | null> {
  if (process.env.NODE_ENV === 'test') {
    if (vitestMocks.has(actionName)) {
      const mockFn = vitestMocks.get(actionName);
      return mockFn ? mockFn() : null;
    }
    try {
      const { task } = await import("cypress");
      return task("get:mock", actionName);
    } catch (e) { 
      // Cypress not found, expected in Vitest 
    }
  }
  return null;
}

export function createMockableAction<T extends (...args: unknown[]) => Promise<unknown>>(actionName: string, actionFn: T): T {
  const mockableAction = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const mock = await getMock(actionName);
    if (mock) { 
      console.log(\`[Mockable Action] Using mock for: \${actionName}\`);
      return mock; 
    }
    return actionFn(...args);
  };
  return mockableAction as T;
}`;
  fs.writeFileSync(factoryPath, factoryContent);
  console.log(
    "📝 Created central mock factory at lib/testing/create-mockable-action.ts"
  );
}

/**
 * Generate TypeScript types from Drizzle schema.
 * This function is consolidated from your separate script.
 */
function generateDrizzleTypes() {
  console.log("🚀 Generating types from Drizzle schema...");

  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

    const tableRegex = /export const (\w+) = pgTable\(/g;
    const enumRegex = /export const (\w+) = pgEnum\(/g;

    const allTables = [...schemaContent.matchAll(tableRegex)].map(
      (match) => match[1]
    );

    // Filter out the ignored tables before generating types.
    const tables = allTables.filter(
      (table) => !TABLES_TO_IGNORE.includes(table)
    );

    const enums = [...schemaContent.matchAll(enumRegex)].map(
      (match) => match[1]
    );

    let content = `// This file is auto-generated by the test harness generator. Do not edit manually.\n`;
    content += `import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';\n`;
    content += `import * as schema from '@/utils/drizzle/schema';\n`;

    tables.forEach((table) => {
      const sName = capitalize(getSingularName(table));
      content += `export type ${sName} = InferSelectModel<typeof schema.${table}>;\n`;
      content += `export type New${sName} = InferInsertModel<typeof schema.${table}>;\n`;
    });

    content += `\n`;

    enums.forEach((enumName) => {
      content += `export type ${capitalize(
        enumName
      )} = (typeof schema.${enumName}.enumValues)[number];\n`;
    });

    if (!fs.existsSync(path.dirname(CLIENT_TYPES_PATH))) {
      fs.mkdirSync(path.dirname(CLIENT_TYPES_PATH), { recursive: true });
    }
    fs.writeFileSync(CLIENT_TYPES_PATH, content);
    console.log(`✅ Generated types file at ${CLIENT_TYPES_PATH}`);
  } catch (error) {
    console.error("❌ Error generating Drizzle types:", error.message);
  }
}

/**
 * Generate query files
 */
function generateQueries(tables) {
  console.log("📖 Generating query files...\n");

  if (!fs.existsSync(CLIENT_QUERIES_DIR)) {
    fs.mkdirSync(CLIENT_QUERIES_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  tables.forEach((table) => {
    const {
      exportName,
      tableName,
      singularName,
      foreignKeys,
      primaryKey,
      primaryKeyType,
      isCompositePrimaryKey,
    } = table;

    // Create table-specific directory
    const tableDir = path.join(CLIENT_QUERIES_DIR, tableName);
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }

    // 1. Get all items
    const getAllQuery = generateGetAllQuery(exportName, tableName);
    const getAllResult = writeQueryFile(
      tableName,
      `get-all-${toKebabCase(tableName)}.ts`,
      getAllQuery
    );
    if (getAllResult.created) created++;
    else updated++;

    // 2. Get single item by ID (skip for composite primary keys or tables without primary keys)
    if (!isCompositePrimaryKey && primaryKey !== null) {
      const getByIdQuery = generateGetByIdQuery(
        exportName,
        tableName,
        singularName,
        primaryKey,
        primaryKeyType
      );
      const getByIdResult = writeQueryFile(
        tableName,
        `get-${toKebabCase(singularName)}.ts`,
        getByIdQuery
      );
      if (getByIdResult.created) created++;
      else updated++;
    } else {
      const reason =
        primaryKey === null ? "no usable primary key" : "composite primary key";
      console.log(`⏭️  Skipping get-by-id for ${tableName} (${reason})`);
    }

    // 3. Get items by foreign key relationships (singular)
    foreignKeys.forEach((fk) => {
      const getByFkQuery = generateGetByForeignKeyQuery(
        exportName,
        tableName,
        fk,
        tables
      );
      const paramName = fk.columnName
        .replace(/Id$/, "")
        .replace(/_id$/, "")
        .replace(/_/g, "");
      const cleanParamName = toKebabCase(paramName);
      const getByFkResult = writeQueryFile(
        tableName,
        `get-${toKebabCase(tableName)}-by-${cleanParamName}.ts`,
        getByFkQuery
      );
      if (getByFkResult.created) created++;
      else updated++;
    });

    // 4. Get items by foreign key relationships (plural)
    foreignKeys.forEach((fk) => {
      const getByFkPluralQuery = generateGetByForeignKeyPluralQuery(
        exportName,
        tableName,
        fk,
        tables
      );
      const paramName = fk.columnName
        .replace(/Id$/, "")
        .replace(/_id$/, "")
        .replace(/_/g, "");
      const pluralParamName = paramName.endsWith("s")
        ? paramName
        : paramName + "s";
      const cleanPluralParamName = toKebabCase(pluralParamName);
      const getByFkPluralResult = writeQueryFile(
        tableName,
        `get-${toKebabCase(tableName)}-by-${cleanPluralParamName}.ts`,
        getByFkPluralQuery
      );
      if (getByFkPluralResult.created) created++;
      else updated++;
    });
  });

  console.log(
    `📖 Query generation complete: ${created} created, ${updated} updated`
  );
}

/**
 * Generate mutation files
 */
function generateMutations(tables) {
  console.log("✏️  Generating mutation files...\n");

  if (!fs.existsSync(CLIENT_MUTATIONS_DIR)) {
    fs.mkdirSync(CLIENT_MUTATIONS_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  tables.forEach((table) => {
    const {
      exportName,
      tableName,
      singularName,
      fields,
      primaryKey,
      primaryKeyType,
      isCompositePrimaryKey,
    } = table;

    // Create table-specific directory
    const tableDir = path.join(CLIENT_MUTATIONS_DIR, tableName);
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }

    // 1. Create single
    const createMutation = generateCreateMutation(
      exportName,
      tableName,
      singularName,
      fields
    );
    const createResult = writeMutationFile(
      tableName,
      `create-${toKebabCase(singularName)}.ts`,
      createMutation
    );
    if (createResult.created) created++;
    else updated++;

    // 2. Create multiple
    const createMultipleMutation = generateCreateMultipleMutation(
      exportName,
      tableName
    );
    const createMultipleResult = writeMutationFile(
      tableName,
      `create-${toKebabCase(tableName)}.ts`,
      createMultipleMutation
    );
    if (createMultipleResult.created) created++;
    else updated++;

    // 3. Update single (skip for composite primary keys or tables without primary keys)
    if (!isCompositePrimaryKey && primaryKey !== null) {
      const updateMutation = generateUpdateMutation(
        exportName,
        tableName,
        singularName,
        fields,
        primaryKey,
        primaryKeyType
      );
      const updateResult = writeMutationFile(
        tableName,
        `update-${toKebabCase(singularName)}.ts`,
        updateMutation
      );
      if (updateResult.created) created++;
      else updated++;
    } else {
      const reason =
        primaryKey === null ? "no usable primary key" : "composite primary key";
      console.log(`⏭️  Skipping update mutations for ${tableName} (${reason})`);
    }

    // 4. Update multiple (skip for composite primary keys or tables without primary keys)
    if (!isCompositePrimaryKey && primaryKey !== null) {
      const updateMultipleMutation = generateUpdateMultipleMutation(
        exportName,
        tableName,
        singularName,
        fields,
        primaryKey,
        primaryKeyType
      );
      const updateMultipleResult = writeMutationFile(
        tableName,
        `update-${toKebabCase(tableName)}.ts`,
        updateMultipleMutation
      );
      if (updateMultipleResult.created) created++;
      else updated++;
    }

    // 5. Delete single (skip for composite primary keys or tables without primary keys)
    if (!isCompositePrimaryKey && primaryKey !== null) {
      const deleteMutation = generateDeleteMutation(
        exportName,
        tableName,
        singularName,
        primaryKey,
        primaryKeyType
      );
      const deleteResult = writeMutationFile(
        tableName,
        `delete-${toKebabCase(singularName)}.ts`,
        deleteMutation
      );
      if (deleteResult.created) created++;
      else updated++;
    } else {
      const reason =
        primaryKey === null ? "no usable primary key" : "composite primary key";
      console.log(`⏭️  Skipping delete mutations for ${tableName} (${reason})`);
    }

    // 6. Delete multiple (skip for composite primary keys or tables without primary keys)
    if (!isCompositePrimaryKey && primaryKey !== null) {
      const deleteMultipleMutation = generateDeleteMultipleMutation(
        exportName,
        tableName,
        singularName,
        primaryKey,
        primaryKeyType
      );
      const deleteMultipleResult = writeMutationFile(
        tableName,
        `delete-${toKebabCase(tableName)}.ts`,
        deleteMultipleMutation
      );
      if (deleteMultipleResult.created) created++;
      else updated++;
    }
  });

  console.log(
    `✏️  Mutation generation complete: ${created} created, ${updated} updated`
  );
}

/**
 * Generate get all query
 */
function generateGetAllQuery(exportName, tableName) {
  // Define the function name for reusability
  const functionName = `getAll${capitalize(exportName)}`;

  return `// utils/queries/${tableName}/get-all-${toKebabCase(tableName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}() {
  try {
    return await db.select().from(${exportName});
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all ${tableName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/queries/${tableName}/get-all-${toKebabCase(
    tableName
  )}.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate get by ID query
 */
function generateGetByIdQuery(
  exportName,
  tableName,
  singularName,
  primaryKey,
  primaryKeyType
) {
  // Define the function name for reusability
  const functionName = `get${capitalize(singularName)}`;

  return `// utils/queries/${tableName}/get-${toKebabCase(singularName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${primaryKey}: ${primaryKeyType}) {
  try {
    const result = await db.select().from(${exportName}).where(eq(${exportName}.${primaryKey}, ${primaryKey}));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching ${singularName}",
      subject: { entityType: "${tableName}", entityId: String(${primaryKey}) },
      context: { function: "_${functionName}", file: "utils/queries/${tableName}/get-${toKebabCase(
    singularName
  )}.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate get by foreign key query
 */
function generateGetByForeignKeyQuery(
  exportName,
  tableName,
  foreignKey,
  tables
) {
  // Get the TypeScript property name from the schema (camelCase)
  const tsPropertyName = getTsPropertyName(foreignKey.columnName);
  const paramName = toCamelCase(tsPropertyName.replace(/Id$/, ""));
  const cleanParamName = toKebabCase(paramName);

  // Determine the correct parameter type.
  // Prefer the local column type to ensure it matches the column used in the comparison (eq).
  const currentTable = tables.find((t) => t.tableName === tableName);
  const localFkField = currentTable?.fields.find(
    (f) => getTsPropertyName(f.name) === tsPropertyName
  );
  let paramType = "string";
  if (localFkField) {
    paramType = localFkField.type === "number" ? "number" : "string";
  } else {
    const foreignTable = tables.find(
      (t) => t.tableName === foreignKey.foreignTable
    );
    paramType = foreignTable ? foreignTable.primaryKeyType : "string";
  }

  // Define the function name for reusability
  const functionName = `get${capitalize(exportName)}By${capitalize(paramName)}`;

  return `// utils/queries/${tableName}/get-${toKebabCase(
    tableName
  )}-by-${cleanParamName}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${paramName}Id: ${paramType}) {
  try {
    return await db.select().from(${exportName}).where(eq(${exportName}.${tsPropertyName}, ${paramName}Id));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching ${tableName} by ${paramName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/queries/${tableName}/get-${toKebabCase(
    tableName
  )}-by-${cleanParamName}.ts", foreignKey: "${tsPropertyName}", foreignId: String(${paramName}Id) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate get by foreign key query (plural version)
 */
function generateGetByForeignKeyPluralQuery(
  exportName,
  tableName,
  foreignKey,
  tables
) {
  // Get the TypeScript property name from the schema (camelCase)
  const tsPropertyName = getTsPropertyName(foreignKey.columnName);
  const paramName = toCamelCase(tsPropertyName.replace(/Id$/, ""));
  const pluralParamName = paramName.endsWith("s") ? paramName : paramName + "s";
  const cleanPluralParamName = toKebabCase(pluralParamName);

  // Determine the correct parameter type.
  // Prefer the local column type to ensure it matches the column used in the comparison (inArray).
  const currentTable = tables.find((t) => t.tableName === tableName);
  const localFkField = currentTable?.fields.find(
    (f) => getTsPropertyName(f.name) === tsPropertyName
  );
  let paramType = "string";
  if (localFkField) {
    paramType = localFkField.type === "number" ? "number" : "string";
  } else {
    const foreignTable = tables.find(
      (t) => t.tableName === foreignKey.foreignTable
    );
    paramType = foreignTable ? foreignTable.primaryKeyType : "string";
  }

  // Define the function name for reusability
  const functionName = `get${capitalize(exportName)}By${capitalize(
    pluralParamName
  )}`;

  return `// utils/queries/${tableName}/get-${toKebabCase(
    tableName
  )}-by-${cleanPluralParamName}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${paramName}Ids: ${paramType}[]) {
  try {
    return await db.select().from(${exportName}).where(inArray(${exportName}.${tsPropertyName}, ${paramName}Ids));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching ${tableName} by ${pluralParamName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/queries/${tableName}/get-${toKebabCase(
    tableName
  )}-by-${cleanPluralParamName}.ts", foreignKey: "${tsPropertyName}", foreignIdsCount: ${paramName}Ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate create mutation
 */
function generateCreateMutation(exportName, tableName, singularName) {
  // Define the function name for reusability
  const functionName = `create${capitalize(singularName)}`;

  return `// utils/mutations/${tableName}/create-${toKebabCase(singularName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(data: typeof ${exportName}.$inferInsert) {
  try {
    const result = await db.insert(${exportName}).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating ${singularName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/mutations/${tableName}/create-${toKebabCase(
    singularName
  )}.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate create multiple mutation
 */
function generateCreateMultipleMutation(exportName, tableName) {
  // Define the function name for reusability
  const functionName = `create${capitalize(exportName)}`;

  return `// utils/mutations/${tableName}/create-${toKebabCase(tableName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(data: (typeof ${exportName}.$inferInsert)[]) {
  try {
    return await db.insert(${exportName}).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple ${tableName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/mutations/${tableName}/create-${toKebabCase(
    tableName
  )}.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate update mutation
 */
function generateUpdateMutation(
  exportName,
  tableName,
  singularName,
  fields,
  primaryKey,
  primaryKeyType
) {
  // Define the function name for reusability
  const functionName = `update${capitalize(singularName)}`;

  return `// utils/mutations/${tableName}/update-${toKebabCase(singularName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${primaryKey}: ${primaryKeyType}, data: Partial<typeof ${exportName}.$inferInsert>) {
  try {
    const result = await db.update(${exportName}).set(data).where(eq(${exportName}.${primaryKey}, ${primaryKey})).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating ${singularName}",
      subject: { entityType: "${tableName}", entityId: String(${primaryKey}) },
      context: { function: "_${functionName}", file: "utils/mutations/${tableName}/update-${toKebabCase(
    singularName
  )}.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate update multiple mutation
 */
function generateUpdateMultipleMutation(
  exportName,
  tableName,
  singularName,
  fields,
  primaryKey,
  primaryKeyType
) {
  // Define the function name for reusability
  const functionName = `update${capitalize(exportName)}`;

  return `// utils/mutations/${tableName}/update-${toKebabCase(tableName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${primaryKey}s: ${primaryKeyType}[], data: Partial<typeof ${exportName}.$inferInsert>) {
  try {
    return await db.update(${exportName}).set(data).where(inArray(${exportName}.${primaryKey}, ${primaryKey}s)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple ${tableName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/mutations/${tableName}/update-${toKebabCase(
    tableName
  )}.ts", count: ${primaryKey}s.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate delete mutation
 */
function generateDeleteMutation(
  exportName,
  tableName,
  singularName,
  primaryKey,
  primaryKeyType
) {
  // Define the function name for reusability
  const functionName = `delete${capitalize(singularName)}`;

  return `// utils/mutations/${tableName}/delete-${toKebabCase(singularName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${primaryKey}: ${primaryKeyType}) {
  try {
    const result = await db.delete(${exportName}).where(eq(${exportName}.${primaryKey}, ${primaryKey})).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting ${singularName}",
      subject: { entityType: "${tableName}", entityId: String(${primaryKey}) },
      context: { function: "_${functionName}", file: "utils/mutations/${tableName}/delete-${toKebabCase(
    singularName
  )}.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Generate delete multiple mutation
 */
function generateDeleteMultipleMutation(
  exportName,
  tableName,
  singularName,
  primaryKey,
  primaryKeyType
) {
  // Define the function name for reusability
  const functionName = `delete${capitalize(exportName)}`;

  return `// utils/mutations/${tableName}/delete-${toKebabCase(tableName)}.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _${functionName}(${primaryKey}s: ${primaryKeyType}[]) {
  try {
    return await db.delete(${exportName}).where(inArray(${exportName}.${primaryKey}, ${primaryKey}s)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple ${tableName}",
      subject: { entityType: "${tableName}" },
      context: { function: "_${functionName}", file: "utils/mutations/${tableName}/delete-${toKebabCase(
    tableName
  )}.ts", count: ${primaryKey}s.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const ${functionName} = createMockableAction('${functionName}', _${functionName});
`;
}

/**
 * Write query file
 */
function writeQueryFile(tableName, filename, content) {
  const filePath = path.join(CLIENT_QUERIES_DIR, tableName, filename);
  const exists = fs.existsSync(filePath);

  fs.writeFileSync(filePath, content);

  if (exists) {
    console.log(`🔄 Updated ${tableName}/${filename}`);
    return { created: false, updated: true };
  } else {
    console.log(`📝 Created ${tableName}/${filename}`);
    return { created: true, updated: false };
  }
}

/**
 * Write mutation file
 */
function writeMutationFile(tableName, filename, content) {
  const filePath = path.join(CLIENT_MUTATIONS_DIR, tableName, filename);
  const exists = fs.existsSync(filePath);

  fs.writeFileSync(filePath, content);

  if (exists) {
    console.log(`🔄 Updated ${tableName}/${filename}`);
    return { created: false, updated: true };
  } else {
    console.log(`📝 Created ${tableName}/${filename}`);
    return { created: true, updated: false };
  }
}

/**
 * Extract enum information from the schema file.
 * This is now simplified to only parse enums, which is more reliable.
 */
function extractSchemaInfo() {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

    // Regex to capture: 1=tsName, 2=dbName
    const enumRegex = /export const (\w+) = pgEnum\("([^"]+)",/g;
    const enums = {};
    let match;

    while ((match = enumRegex.exec(schemaContent)) !== null) {
      const [, tsName, dbName] = match;
      enums[tsName] = { dbName };
    }

    // We only need enums from this function. Table info is more reliably parsed from the snapshot.
    return { enums };
  } catch (error) {
    console.error("❌ Error extracting schema info:", error.message);
    return { enums: {} };
  }
}

/**
 * Generate type-safe mock factories with proper enum and type support.
 */
function generateMockFactories(tables, enums) {
  const factoriesPath = path.join(CLIENT_MOCKS_DIR, "factories.ts");

  // Get all singular type names for the import statement.
  const typeNames = tables.map((t) =>
    capitalize(getSingularName(t.exportName))
  );

  // Get all enum variable names for the import statement.
  const enumNames = Object.keys(enums);

  // Map database enum names back to their TypeScript variable names for easy lookup.
  const dbEnumNameToTsName = {};
  for (const tsName in enums) {
    dbEnumNameToTsName[enums[tsName].dbName] = tsName;
  }

  let content = `// This file is auto-generated by the test harness generator. Do not edit manually.
import { faker } from '@faker-js/faker';
import type { ${typeNames.join(", ")} } from '@/types';
${
  enumNames.length > 0
    ? `import { ${enumNames.join(", ")} } from '@/utils/drizzle/schema';\n`
    : ""
}
`;

  tables.forEach((table) => {
    const typeName = capitalize(getSingularName(table.exportName));
    content += `
export function createMock${typeName}(overrides: Partial<${typeName}> = {}): ${typeName} {
  const defaults: ${typeName} = {
`;

    table.fields.forEach((field) => {
      const tsFieldName = getTsPropertyName(field.name);
      let fakerLine = "";

      // 1. Check if it's an enum by looking up its dbType
      if (dbEnumNameToTsName[field.dbType]) {
        const enumTsName = dbEnumNameToTsName[field.dbType];
        fakerLine = `faker.helpers.arrayElement(${enumTsName}.enumValues)`;
      }
      // 2. Primary key heuristic
      else if (tsFieldName === "id" || field.isPrimaryKey) {
        fakerLine =
          field.type === "number"
            ? "faker.number.int()"
            : "faker.string.uuid()";
      }
      // 3. Prefer type-based generation to avoid name heuristics overriding numeric types
      else if (field.type === "number") {
        fakerLine = "faker.number.int({ min: 1, max: 1000 })";
      } else if (field.type === "boolean") {
        fakerLine = "faker.datatype.boolean()";
      } else if (
        field.type === "string" &&
        (field.dbType.includes("timestamp") || field.dbType.includes("date"))
      ) {
        fakerLine = "faker.date.past().toISOString()";
      } else if (field.type.includes("[]")) {
        fakerLine = "[]";
      } else if (field.dbType === "jsonb" || field.dbType === "json") {
        fakerLine = "{}";
      }
      // 4. Name-based patterns (only for non-numeric fields)
      else if (tsFieldName.toLowerCase().includes("email")) {
        fakerLine = "faker.internet.email()";
      } else if (tsFieldName.toLowerCase().includes("firstname")) {
        fakerLine = "faker.person.firstName()";
      } else if (tsFieldName.toLowerCase().includes("lastname")) {
        fakerLine = "faker.person.lastName()";
      } else if (
        tsFieldName.toLowerCase().includes("name") ||
        tsFieldName.toLowerCase().includes("title")
      ) {
        fakerLine = "faker.lorem.words(3)";
      } else if (
        tsFieldName.toLowerCase().includes("description") ||
        tsFieldName.toLowerCase().includes("message") ||
        tsFieldName.toLowerCase().includes("content")
      ) {
        fakerLine = "faker.lorem.paragraph()";
      } else if (
        tsFieldName.toLowerCase().includes("token") ||
        tsFieldName.toLowerCase().includes("path")
      ) {
        fakerLine = "faker.string.alphanumeric(32)";
      } else if (tsFieldName.toLowerCase().includes("url")) {
        fakerLine = "faker.internet.url()";
      }
      // 5. Additional type-based defaults
      else if (field.dbType === "uuid") {
        fakerLine = "faker.string.uuid()";
      }
      // 6. Fallback to a generic string
      else {
        fakerLine = "faker.lorem.word()";
      }

      content += `    ${tsFieldName}: ${fakerLine},\n`;
    });

    content += `  };

  return { ...defaults, ...overrides } as ${typeName};
}\n`;
  });

  fs.writeFileSync(factoriesPath, content);
  console.log(
    "🏭 Generated type-safe mock factories with enum support: mocks/factories.ts"
  );
}

/**
 * Generate a dynamic "Mock Database"
 */
function generateMockDb(tables) {
  const mockDbPath = path.join(CLIENT_MOCKS_DIR, "mock-db.ts");

  let content = `
import * as mockSchema from './schema';
import { faker } from '@faker-js/faker';
import { ${tables
    .map((t) => `createMock${capitalize(getSingularName(t.exportName))}`)
    .join(", ")} } from './factories';
import type { ${tables
    .map((t) => capitalize(getSingularName(t.exportName)))
    .join(", ")} } from '@/types';

// A type-safe, in-memory database for testing
export class MockDb {
`;
  // Initialize data stores
  tables.forEach((table) => {
    const typeName = capitalize(getSingularName(table.exportName));
    content += `  ${table.exportName}: ${typeName}[];\n`;
  });

  content += `
  constructor() {
    // Create deep copies to ensure test isolation
    ${tables
      .map(
        (t) =>
          `this.${t.exportName} = JSON.parse(JSON.stringify(mockSchema.${t.exportName}));`
      )
      .join("\n    ")}
  }
`;
  // Generate dynamic query and mutation methods
  tables.forEach((table) => {
    const { exportName, primaryKey, foreignKeys } = table;
    const singularName = getSingularName(exportName);
    const typeName = capitalize(singularName);
    const pkType = table.primaryKeyType === "number" ? "number" : "string";

    // --- QUERIES ---
    content += `\n  // ${exportName.toUpperCase()} Queries\n`;
    content += `  getAll${capitalize(
      exportName
    )}() { return this.${exportName}; }\n`;
    if (primaryKey && table.primaryKeyType !== "composite") {
      content += `  get${typeName}(id: ${pkType}) { return this.${exportName}.find(item => item.id === id) || null; }\n`;
    }

    // Add foreign key relationship queries
    foreignKeys.forEach((fk) => {
      const fkFieldName = getTsPropertyName(fk.columnName);
      const relatedTableName = fk.foreignTable;
      const relatedTable = tables.find((t) => t.tableName === relatedTableName);
      if (relatedTable) {
        const relatedSingularName = getSingularName(relatedTable.exportName);
        const relatedTypeName = capitalize(relatedSingularName);
        content += `  get${capitalize(exportName)}By${capitalize(
          relatedSingularName
        )}(${relatedSingularName}Id: ${
          relatedTable.primaryKeyType === "number" ? "number" : "string"
        }) { 
    return this.${exportName}.filter(item => item.${fkFieldName} === ${relatedSingularName}Id); 
  }\n`;
      }
    });

    // --- MUTATIONS ---
    content += `\n  // ${exportName.toUpperCase()} Mutations\n`;
    content += `  create${typeName}(data: Partial<${typeName}>) {
    const newItem = createMock${typeName}({ ...data, id: data.id ?? ${
      pkType === "number" ? "faker.number.int()" : "faker.string.uuid()"
    } });
    this.${exportName}.push(newItem);
    return newItem;
  }\n`;

    if (primaryKey && table.primaryKeyType !== "composite") {
      content += `  update${typeName}(id: ${pkType}, data: Partial<${typeName}>) {
    const itemIndex = this.${exportName}.findIndex(item => item.id === id);
    if (itemIndex === -1) return null;
    this.${exportName}[itemIndex] = { ...this.${exportName}[itemIndex], ...data } as ${typeName};
    return this.${exportName}[itemIndex];
  }\n`;
      content += `  delete${typeName}(id: ${pkType}) {
    const itemIndex = this.${exportName}.findIndex(item => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.${exportName}.splice(itemIndex, 1);
    return deletedItem[0];
  }\n`;
    }
  });

  content += `\n}`;
  fs.writeFileSync(mockDbPath, content);
  console.log("🧠 Generated dynamic mock database: mocks/mock-db.ts");
}

/**
 * Generate the Vitest setup file with dynamic mock database
 */
function generateVitestSetupFile(tables) {
  const setupPath = path.join(CLIENT_TEST_DIR, "setup.ts");
  const content = `// This file is auto-generated by the test harness generator.
// It imports modular mocks and sets up the dynamic mock database.

import { afterEach, beforeEach, vi } from "vitest";
import { setVitestMock, clearVitestMocks } from "@/lib/testing/create-mockable-action";
import { MockDb } from "@/mocks/mock-db";
import "@testing-library/jest-dom";

// Import all mock modules to execute their vi.mock() calls globally
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/navigation";
import "@/mocks/extra";

// This instance will be recreated for each test, ensuring isolation.
let mockDb: MockDb;

// --- Centralized Server Action Mocks ---
// This part remains dynamic, as it depends on the database schema.
function setupMocks() {
${tables
  .map((table) => {
    const { exportName } = table;
    const singularName = getSingularName(exportName);
    return `  setVitestMock('getAll${capitalize(
      exportName
    )}', () => mockDb.getAll${capitalize(exportName)}());
  setVitestMock('get${capitalize(
    singularName
  )}', (id) => mockDb.get${capitalize(singularName)}(id));
  setVitestMock('create${capitalize(
    singularName
  )}', (data) => mockDb.create${capitalize(singularName)}(data));
  setVitestMock('update${capitalize(
    singularName
  )}', (id, data) => mockDb.update${capitalize(singularName)}(id, data));
  setVitestMock('delete${capitalize(
    singularName
  )}', (id) => mockDb.delete${capitalize(singularName)}(id));`;
  })
  .join("\n")}
}

beforeEach(() => {
  mockDb = new MockDb(); // Create a fresh in-memory DB for each test
  setupMocks();
});

afterEach(() => {
  clearVitestMocks();
  vi.clearAllMocks();
});

// Expose the mockDb instance for test-specific customizations
export { mockDb };
`;
  fs.writeFileSync(setupPath, content.trim());
  console.log("✅ Generated central Vitest setup file: test/setup.ts");
}

/**
 * Generate the custom render function
 */
function generateCustomRender() {
  const renderPath = path.join(CLIENT_TEST_DIR, "custom-render.tsx");

  const renderContent = `import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import { WebSocketProvider } from "@/contexts/websocket-context";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockProfile = {
  id: "test-profile-id", 
  userId: 1, 
  firstName: "Test", 
  lastName: "User", 
  alias: "testuser",
  role: "admin" as const, 
  active: true, 
  viewedIntro: true, 
  viewedChat: true,
  createdAt: new Date().toISOString(), 
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(), 
  lastActive: new Date().toISOString(), 
  defaultProfile: false,
  reqPerDay: 100
};

const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <ProfileProvider activeProfile={mockProfile}>
      <AnalyticsProvider>
        <AssistantProvider>
          <WebSocketProvider profileId={mockProfile.id}>
            <TourProvider>
              <SidebarProvider>{children}</SidebarProvider>
            </TourProvider>
          </WebSocketProvider>
        </AssistantProvider>
      </AnalyticsProvider>
    </ProfileProvider>
  </QueryClientProvider>
);

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => 
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
`;

  fs.writeFileSync(renderPath, renderContent);
  console.log("📝 Custom render function generated at test/custom-render.tsx");
}

/**
 * Create shared route factory for API routes
 */
function createRouteFactoryFile() {
  const apiDir = path.join(__dirname, "../../client/lib/api");
  fs.mkdirSync(apiDir, { recursive: true });
  const factoryPath = path.join(apiDir, "route-factory.ts");
  const content = `function ensureJson<T>(fn: () => Promise<T>): Promise<Response> { return Promise.resolve().then(fn).then((data) => Response.json(data)); }

export async function handle<T>(fn: () => Promise<T>, onError?: (e: unknown) => void): Promise<Response> {
  try {
    return await ensureJson(fn);
  } catch (e: unknown) {
    onError?.(e);
    const err = e as { statusCode?: number; status?: number; message?: string; name?: string; flatten?: () => unknown };
    const status = (err?.statusCode || err?.status || 500) as number;
    const msg = (err?.message || "Internal Server Error") as string;
    const body = err?.name === "ZodError" ? { error: err.flatten?.() ?? msg } : { error: msg };
    return Response.json(body, { status });
  }
}
`;
  const res = writeFileSmart(factoryPath, content, FORCE_ROUTES);
  if (res.created)
    console.log("📝 Created route factory: lib/api/route-factory.ts");
  else if (res.skipped) console.log("⏭️  Kept existing route factory");
  else console.log("🔄 Updated route factory (backup saved)");
}

/**
 * Generate Repos per table (CRUD + FK helpers) with permissive Zod fallbacks
 */
function generateRepos(tables) {
  console.log("🏗️  Generating repos...\n");
  const REPO_DIR = path.join(__dirname, "../../client/lib/repos");
  fs.mkdirSync(REPO_DIR, { recursive: true });

  tables.forEach((t) => {
    const {
      exportName,
      tableName,
      singularName,
      primaryKey,
      primaryKeyType,
      isCompositePrimaryKey,
      foreignKeys,
      fields,
    } = t;

    const repoFile = path.join(REPO_DIR, `${singularName}Repo.ts`);
    const typeName = capitalize(getSingularName(exportName));
    const pkTs = primaryKeyType === "number" ? "number" : "string";

    const fkHelpers = (foreignKeys || [])
      .map((fk) => {
        const tsProp = getTsPropertyName(fk.columnName);
        const relatedTable = tables.find(
          (x) => x.tableName === fk.foreignTable
        );
        const relName = relatedTable
          ? getSingularName(relatedTable.exportName)
          : tsProp.replace(/Id$/, "");
        const relTypeName = relatedTable
          ? capitalize(getSingularName(relatedTable.exportName))
          : capitalize(relName);
        const paramTs =
          fields.find((f) => getTsPropertyName(f.name) === tsProp)?.type ===
          "number"
            ? "number"
            : "string";

        return `  async listBy${relTypeName}(${relName}Id: ${paramTs}) {
    const db = await getDb();
    return db.select().from(${exportName}).where(eq(${exportName}.${tsProp}, ${relName}Id));
  },

  async listBy${relTypeName}s(${relName}Ids: ${paramTs}[]) {
    const db = await getDb();
    if (!Array.isArray(${relName}Ids) || ${relName}Ids.length === 0) return [];
    return db.select().from(${exportName}).where(inArray(${exportName}.${tsProp}, ${relName}Ids));
  },`;
      })
      .join("\n\n");

    const pkCrud =
      !isCompositePrimaryKey && primaryKey
        ? `
  async find(id: ${pkTs}) {
    const db = await getDb();
    const rows = await db.select().from(${exportName}).where(eq(${exportName}.${primaryKey}, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("${typeName} with id " + id + " not found");
    return rows[0];
  },

  async update(id: ${pkTs}, patch: ${typeName}Update) {
    const db = await getDb();
    const rows = await db.update(${exportName}).set(patch).where(eq(${exportName}.${primaryKey}, id)).returning();
    if (!rows[0]) throw HttpError.notFound("${typeName} with id " + id + " not found");
    return rows[0];
  },

  async remove(id: ${pkTs}) {
    const db = await getDb();
    const rows = await db.delete(${exportName}).where(eq(${exportName}.${primaryKey}, id)).returning();
    if (!rows[0]) throw HttpError.notFound("${typeName} with id " + id + " not found");
  },`
        : `
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: ${typeName}Update) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },`;

    const hasFks = (foreignKeys || []).length > 0;
    const needsEq = (!isCompositePrimaryKey && primaryKey) || hasFks;
    const needsInArray = hasFks;
    const drizzleOrmImports = [
      needsEq ? "eq" : null,
      needsInArray ? "inArray" : null,
    ]
      .filter(Boolean)
      .join(", ");

    const content = `
import { createInsertSchema } from "drizzle-zod";
${
  drizzleOrmImports
    ? `import { ${drizzleOrmImports} } from "drizzle-orm";\n`
    : ""
}
import { db as drizzleDb } from "@/utils/drizzle/db";
import { ${exportName} } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ${typeName} = typeof ${exportName}.$inferSelect;
export type ${typeName}Create = typeof ${exportName}.$inferInsert;
export type ${typeName}Update = Partial<${typeName}Create>;

// Schemas derived from Drizzle table
export const ${typeName}CreateSchema = createInsertSchema(${exportName});
export const ${typeName}UpdateSchema = ${typeName}CreateSchema.partial();

async function getDb() { return drizzleDb; }

export const ${singularName}Repo = {
  async create(payload: ${typeName}Create) {
    const db = await getDb();
    const rows = await db.insert(${exportName}).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(${exportName}).orderBy(${exportName}.createdAt ?? ${exportName}.id);
  },${pkCrud}

${fkHelpers}
};`;

    const res = writeFileSmart(repoFile, content, FORCE_ROUTES);
    if (res.created)
      console.log(`📝 Created/Updated repo: lib/repos/${singularName}Repo.ts`);
    else if (res.skipped)
      console.log(`⏭️  Kept existing repo: lib/repos/${singularName}Repo.ts`);
    else
      console.log(
        `🔄 Updated repo: lib/repos/${singularName}Repo.ts (backup saved)`
      );
  });
}

/**
 * Generate API routes (/api/v1/:table and /api/v1/:table/[id])
 */
function generateApiRoutes(tables) {
  console.log("🛣️  Generating BFF API routes...\n");
  const API_ROOT = path.join(__dirname, "../../client/app/api/v1");
  fs.mkdirSync(API_ROOT, { recursive: true });

  tables.forEach((t) => {
    const {
      exportName,
      tableName,
      singularName,
      primaryKey,
      primaryKeyType,
      isCompositePrimaryKey,
    } = t;
    const typeName = capitalize(getSingularName(exportName));
    const pkTs = primaryKeyType === "number" ? "number" : "string";

    const indexDir = path.join(API_ROOT, tableName);
    fs.mkdirSync(indexDir, { recursive: true });
    const indexRoute = `import { handle } from "@/lib/api/route-factory";
import { ${singularName}Repo, ${typeName}CreateSchema } from "@/lib/repos/${singularName}Repo";
import type { ${typeName}Create } from "@/lib/repos/${singularName}Repo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => ${singularName}Repo.list(),
    (e: unknown) =>
      log.error("api.${tableName}.list.failed", {
        message: "Failed to list ${tableName}",
        subject: { entityType: "${tableName}" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ${typeName}CreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as ${typeName}Create;
  return handle(
    () => ${singularName}Repo.create(payload),
    (e: unknown) =>
      log.error("api.${tableName}.create.failed", {
        message: "Failed to create ${singularName}",
        subject: { entityType: "${tableName}" },
        context: { body: json },
        error: e,
      })
  );
}
`;
    const indexRes = writeFileSmart(
      path.join(indexDir, "route.ts"),
      indexRoute,
      FORCE_ROUTES
    );
    if (indexRes.created) console.log(`📝 /api/v1/${tableName}/route.ts`);
    else if (indexRes.skipped)
      console.log(`⏭️  Kept existing /api/v1/${tableName}/route.ts`);
    else console.log(`🔄 Updated /api/v1/${tableName}/route.ts (backup saved)`);

    const idDir = path.join(indexDir, "[id]");
    fs.mkdirSync(idDir, { recursive: true });

    const idRoute =
      !isCompositePrimaryKey && primaryKey
        ? `import { handle } from "@/lib/api/route-factory";
import { ${singularName}Repo, ${typeName}UpdateSchema } from "@/lib/repos/${singularName}Repo";
import type { ${typeName}Update } from "@/lib/repos/${singularName}Repo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => ${singularName}Repo.find(${pkTs === "number" ? "+id" : "id"}),
    (e: unknown) =>
      log.error("api.${tableName}.get.failed", {
        message: "Failed to fetch ${singularName}",
        subject: { entityType: "${tableName}", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = ${typeName}UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as ${typeName}Update;
  return handle(
    () => ${singularName}Repo.update(${
            pkTs === "number" ? "+id" : "id"
          }, patch),
    (e: unknown) =>
      log.error("api.${tableName}.patch.failed", {
        message: "Failed to update ${singularName}",
        subject: { entityType: "${tableName}", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await ${singularName}Repo.remove(${
            pkTs === "number" ? "+id" : "id"
          }); return {}; },
    (e: unknown) =>
      log.error("api.${tableName}.delete.failed", {
        message: "Failed to delete ${singularName}",
        subject: { entityType: "${tableName}", entityId: String(id) },
        error: e,
      })
  );
}
`
        : `// Composite/no PK table – implement custom id semantics if needed
export async function GET() { return Response.json({ error: "Not supported for composite/no primary key tables" }, { status: 400 }); }
export async function PATCH() { return Response.json({ error: "Not supported" }, { status: 400 }); }
export async function DELETE() { return Response.json({ error: "Not supported" }, { status: 400 }); }
`;

    const idRes = writeFileSmart(
      path.join(idDir, "route.ts"),
      idRoute,
      FORCE_ROUTES
    );
    if (idRes.created) console.log(`📝 /api/v1/${tableName}/[id]/route.ts`);
    else if (idRes.skipped)
      console.log(`⏭️  Kept existing /api/v1/${tableName}/[id]/route.ts`);
    else
      console.log(
        `🔄 Updated /api/v1/${tableName}/[id]/route.ts (backup saved)`
      );
  });
}

/**
 * Generate foreign key API routes (/by/:fk/[id] and /by/:fk/batch)
 */
function generateFkApiRoutes(tables) {
  console.log("🛣️  Generating FK API routes...\n");
  const API_ROOT = path.join(__dirname, "../../client/app/api/v1");
  fs.mkdirSync(API_ROOT, { recursive: true });

  tables.forEach((t) => {
    const { tableName, exportName, singularName, foreignKeys, fields } = t;
    if (!foreignKeys || foreignKeys.length === 0) return;

    const baseDir = path.join(API_ROOT, tableName, "by");
    fs.mkdirSync(baseDir, { recursive: true });

    foreignKeys.forEach((fk) => {
      const tsProp = getTsPropertyName(fk.columnName);
      const related = tables.find((x) => x.tableName === fk.foreignTable);
      const relName = related
        ? getSingularName(related.exportName)
        : tsProp.replace(/Id$/, "");
      const relTypeName = related
        ? capitalize(getSingularName(related.exportName))
        : capitalize(relName);
      const paramTs =
        fields.find((f) => getTsPropertyName(f.name) === tsProp)?.type ===
        "number"
          ? "number"
          : "string";

      const fkDir = path.join(baseDir, tsProp);
      fs.mkdirSync(fkDir, { recursive: true });

      const singleDir = path.join(fkDir, "[id]");
      fs.mkdirSync(singleDir, { recursive: true });
      const singleRoute = `import { handle } from "@/lib/api/route-factory";
import { ${singularName}Repo } from "@/lib/repos/${singularName}Repo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => ${singularName}Repo.listBy${relTypeName}(${
        paramTs === "number" ? "+id" : "id"
      }),
    (e: unknown) =>
      log.error("api.${tableName}.by.${tsProp}.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "${tableName}" },
        context: { foreignKey: "${tsProp}", id },
        error: e,
      })
  );
}
`;
      const singleRes = writeFileSmart(
        path.join(singleDir, "route.ts"),
        singleRoute,
        FORCE_ROUTES
      );
      if (singleRes.created)
        console.log(`📝 /api/v1/${tableName}/by/${tsProp}/[id]/route.ts`);
      else if (singleRes.skipped)
        console.log(
          `⏭️  Kept existing /api/v1/${tableName}/by/${tsProp}/[id]/route.ts`
        );
      else
        console.log(
          `🔄 Updated /api/v1/${tableName}/by/${tsProp}/[id]/route.ts (backup saved)`
        );

      const batchDir = path.join(fkDir, "batch");
      fs.mkdirSync(batchDir, { recursive: true });
      const batchRoute = `import { handle } from "@/lib/api/route-factory";
import { ${singularName}Repo } from "@/lib/repos/${singularName}Repo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(${
        paramTs === "number" ? "z.number()" : "z.string()"
      }).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => ${singularName}Repo.listBy${relTypeName}s(parsed.data.ids),
    (e: unknown) =>
      log.error("api.${tableName}.by.${tsProp}.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "${tableName}" },
        context: { foreignKey: "${tsProp}", count: parsed.data.ids.length },
        error: e,
      })
  );
}
`;
      const batchRes = writeFileSmart(
        path.join(batchDir, "route.ts"),
        batchRoute,
        FORCE_ROUTES
      );
      if (batchRes.created)
        console.log(`📝 /api/v1/${tableName}/by/${tsProp}/batch/route.ts`);
      else if (batchRes.skipped)
        console.log(
          `⏭️  Kept existing /api/v1/${tableName}/by/${tsProp}/batch/route.ts`
        );
      else
        console.log(
          `🔄 Updated /api/v1/${tableName}/by/${tsProp}/batch/route.ts (backup saved)`
        );
    });
  });
}

/**
 * Extend lib/api/keys.ts with base keys per table
 */
function generateQueryKeys(tables) {
  const KEYS_FILE = path.join(__dirname, "../../client/lib/api/keys.ts");
  let existing = "";
  if (fs.existsSync(KEYS_FILE)) existing = fs.readFileSync(KEYS_FILE, "utf8");

  let appended = "";
  tables.forEach((t) => {
    const base = t.tableName;
    const varName = `${getSingularName(base)}Keys`
      .replace(/^[a-z]/, (c) => c.toLowerCase())
      .replace(/_[a-z]/g, (s) => s[1].toUpperCase());
    if (existing.includes(`export const ${varName} =`)) return;

    appended += `
export const ${varName} = {
  all: ["${base}"] as const,
  list: (filters?: unknown) => [...${varName}.all, { filters }] as const,
  detail: (id: string | number) => [...${varName}.all, String(id)] as const,
};`;
  });

  if (appended) {
    fs.writeFileSync(KEYS_FILE, existing + appended);
    console.log("🔑 Extended lib/api/keys.ts with table keys");
  } else {
    console.log("🔑 Query keys already present; no changes");
  }
}

/**
 * Extend lib/api/keys.ts with FK keys per table
 */
function extendQueryKeysWithFks(tables) {
  const KEYS_FILE = path.join(__dirname, "../../client/lib/api/keys.ts");
  let existing = fs.existsSync(KEYS_FILE)
    ? fs.readFileSync(KEYS_FILE, "utf8")
    : "";

  let appended = "";
  tables.forEach((t) => {
    const base = t.tableName;
    const varName = `${getSingularName(base)}Keys`
      .replace(/^[a-z]/, (c) => c.toLowerCase())
      .replace(/_[a-z]/g, (s) => s[1].toUpperCase());
    if (!existing.includes(`export const ${varName} =`)) return;
    (t.foreignKeys || []).forEach((fk) => {
      const tsProp = getTsPropertyName(fk.columnName);
      if (existing.includes(`"${base}:by:${tsProp}"`)) return;
      appended += `
export const ${varName}By${capitalize(tsProp)} = {
  one: (id: string | number) => ["${base}:by:${tsProp}", String(id)] as const,
  many: (ids: Array<string | number>) => ["${base}:by:${tsProp}:batch", ids.map(String).sort()] as const,
};`;
    });
  });

  if (appended) {
    fs.writeFileSync(KEYS_FILE, existing + appended);
    console.log("🔑 Extended lib/api/keys.ts with FK keys");
  }
}

/**
 * Generate minimal React Query hooks per table (non-destructive)
 */
function generateHooks(tables) {
  console.log("🪝 Generating minimal hooks...\n");
  const HOOKS_DIR = path.join(__dirname, "../../client/lib/api/hooks");
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  tables.forEach((t) => {
    const {
      tableName,
      exportName,
      singularName,
      primaryKey,
      primaryKeyType,
      isCompositePrimaryKey,
      foreignKeys,
    } = t;
    const typeName = capitalize(getSingularName(exportName));
    const pkTs = primaryKeyType === "number" ? "number" : "string";

    const fkImports = (foreignKeys || []).length
      ? `, ${(foreignKeys || [])
          .map(
            (fk) =>
              `${singularName}KeysBy${capitalize(
                getTsPropertyName(fk.columnName)
              )}`
          )
          .join(", ")}`
      : "";

    const fkBlocks = (foreignKeys || [])
      .map((fk) => {
        const tsProp = getTsPropertyName(fk.columnName);
        const cap = capitalize(tsProp);
        return `
export function use${capitalize(exportName)}By${cap}(id: ${pkTs}) {
  return useQuery({
    queryKey: ${singularName}KeysBy${cap}.one(id),
    queryFn: () => api(\`/api/v1/${tableName}/by/${tsProp}/\${id}\`),
    enabled: id !== undefined && id !== null,
  });
}

export function use${capitalize(exportName)}By${cap}Batch(ids: ${pkTs}[]) {
  return useQuery({
    queryKey: ${singularName}KeysBy${cap}.many(ids),
    queryFn: () => api(\`/api/v1/${tableName}/by/${tsProp}/batch\`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}`;
      })
      .join("\n");

    const withPk =
      !isCompositePrimaryKey && primaryKey
        ? `
export function use${typeName}(id: ${pkTs}, enabled = true) {
  return useQuery({
    queryKey: ${singularName}Keys.detail(id),
    queryFn: () => api<${typeName}>(\`/api/v1/${tableName}/\${id}\`),
    enabled,
  });
}

export function useUpdate${typeName}(id: ${pkTs}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ${typeName}Update) => api<${typeName}>(\`/api/v1/${tableName}/\${id}\`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ${singularName}Keys.detail(id) }),
  });
}

export function useDelete${typeName}(id: ${pkTs}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(\`/api/v1/${tableName}/\${id}\`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ${singularName}Keys.all }),
  });
}`
        : "";

    const listHookName =
      exportName === getSingularName(exportName)
        ? `use${typeName}s`
        : `use${capitalize(exportName)}`;
    const content = `// AUTO-GENERATED minimal hooks for ${tableName}
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ${typeName}, ${typeName}Create, ${typeName}Update } from "@/lib/repos/${singularName}Repo";
import { ${singularName}Keys${fkImports ? "," : ""} ${
      fkImports ? fkImports.slice(2) : ""
    } } from "@/lib/api/keys";

export function ${listHookName}(filters?: unknown) {
  return useQuery({
    queryKey: ${singularName}Keys.list(filters),
    queryFn: () => api<${typeName}[]>("/api/v1/${tableName}"),
  });
}

export function useCreate${typeName}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ${typeName}Create) => api<${typeName}>("/api/v1/${tableName}", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ${singularName}Keys.all }),
  });
}
${withPk}
${fkBlocks}
`;

    const filePath = path.join(HOOKS_DIR, `${tableName}.ts`);
    const res = writeFileSmart(filePath, content, FORCE_HOOKS);
    if (res.created) console.log(`📝 hooks: lib/api/hooks/${tableName}.ts`);
    else if (res.skipped)
      console.log(`⏭️  Kept existing hooks for ${tableName}`);
    else console.log(`🔄 Updated hooks for ${tableName} (backup saved)`);
  });
}

/**
 * Main generation function
 */
async function generateTestHarness(options = {}) {
  console.log("🚀 Generating full test harness for Cypress and Vitest...\n");

  const skipSnapshot =
    process.argv.includes("--skip-snapshot") || options.skipSnapshot;
  const useSchema =
    process.argv.includes("--from-schema") || options.fromSchema;
  const usePull = process.argv.includes("--pull") || options.pull;

  // ** MODIFICATION **: Call type generation first.
  generateDrizzleTypes();

  if (!skipSnapshot) {
    if (usePull) {
      pullAndGenerateSnapshot();
    } else if (useSchema) {
      generateSnapshotFromSchema();
    } else {
      generateSnapshot();
    }
  } else {
    console.log("⏭️  Skipping snapshot generation (using existing snapshot)\n");
  }

  createMockFactoryFile();
  generateCustomRender();

  // ** MODIFICATION **: Extract both tables and enums.
  const tables = extractTableInfo();
  const { enums } = extractSchemaInfo(); // Get enums from schema file.

  console.log(`📊 Found ${tables.length} tables:`);
  tables.forEach((table) => {
    console.log(
      `  - ${table.exportName} (${table.foreignKeys.length} foreign keys)`
    );
  });
  console.log("");
  console.log(`🔎 Found ${Object.keys(enums).length} enums.`);
  console.log("");

  console.log("🔧 Generating mockable server actions...");
  generateQueries(tables);
  generateMutations(tables);

  console.log("🎭 Generating mock factories and Vitest setup...");
  // ** MODIFICATION **: Pass both tables and enums to the factory generator.
  generateMockFactories(tables, enums);
  generateMockDb(tables);
  generateVitestSetupFile(tables);

  // NEW: BFF generation (repos, routes, keys)
  createRouteFactoryFile();
  generateRepos(tables);
  generateApiRoutes(tables);
  generateFkApiRoutes(tables);
  generateQueryKeys(tables);
  extendQueryKeysWithFks(tables);

  // Optional: generate minimal hooks per table (non-destructive unless --force-hooks)
  generateHooks(tables);

  console.log(
    "\n📝 Note: Make sure you have the following mock files in client/mocks/:"
  );
  console.log("  - api.ts (for API endpoint mocks)");
  console.log("  - auth.ts (for authentication and profile mocks)");
  console.log("  - navigation.ts (for routing mocks)");
  console.log(
    "  - extra.ts (for global mocks like browser APIs, third-party libs)"
  );

  console.log("\n✅ Test harness generation complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for help flag
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
🚀 Unified Test Harness Generator

Usage: node scripts/generate-test-harness.js [options]

Options:
  --skip-snapshot    Skip generating fresh snapshot (use existing one)
  --pull             Use 'drizzle-kit pull' to get latest database state (recommended)
  --from-schema      Generate snapshot from schema file instead of database
  --help, -h         Show this help message

Description:
  This script generates a complete test harness for both Cypress and Vitest including:
  1. Mockable server actions (queries and mutations) with createMockableAction wrapper
  2. Type-safe mock factories with enum support
  3. Comprehensive Vitest setup with centralized mocking and global mocks
  4. Custom render function with all context providers pre-configured
  5. Centralized mock factory supporting both Vitest and Cypress environments

Generated Files:
  - client/lib/testing/create-mockable-action.ts (mock factory)
  - client/test/custom-render.tsx (custom render with providers)
  - client/test/setup.ts (comprehensive Vitest setup)
  - client/mocks/factories.ts (type-safe mock factories with enum support)
  - client/mocks/mock-db.ts (dynamic mock database)
  - client/utils/queries/* (mockable query functions)
  - client/utils/mutations/* (mockable mutation functions)

Note: client/mocks/schema.ts should be hand-curated for your specific test data needs

Examples:
  node scripts/generate-test-harness.js                 # Use introspect (default)
  node scripts/generate-test-harness.js --pull          # Use pull (recommended)
  node scripts/generate-test-harness.js --from-schema   # Generate from schema file
  node scripts/generate-test-harness.js --skip-snapshot # Use existing snapshot

Recommended workflow:
  1. Make database changes (migrations, manual changes, etc.)
  2. Run with --pull to ensure you have the latest database state
  3. Generated test harness will match your actual database structure
  4. Use the custom render function in your Vitest tests for automatic mocking
`);
    process.exit(0);
  }

  generateTestHarness().catch(console.error);
}

export { generateTestHarness };
