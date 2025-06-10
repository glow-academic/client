#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Path configurations
const SCHEMA_PATH = path.join(__dirname, "../drizzle/schema.ts");
const QUERIES_DIR = path.join(__dirname, "../utils/queries");
const MUTATIONS_DIR = path.join(__dirname, "../utils/mutations");
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
        `⚠️  Table "${dbTableName}" exists in database but not found in schema file`,
      );
    }
  });

  // Check for schema tables not in database
  schemaTables.forEach((exportName, tableName) => {
    const dbTable = Object.values(snapshot.tables || {}).find(
      (table) => table.name === tableName,
    );
    if (!dbTable) {
      warnings.push(
        `⚠️  Table "${tableName}" (${exportName}) exists in schema but not in database`,
      );
    }
  });

  if (warnings.length > 0) {
    console.log("🔍 Schema mismatch warnings:");
    warnings.forEach((warning) => console.log(`  ${warning}`));
    console.log(
      "💡 Consider running migrations or using --pull to sync with database\n",
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
    } catch (error) {
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

      // Parse columns
      const fields = Object.entries(tableData.columns || {}).map(
        ([columnKey, columnData]) => ({
          name: columnData.name,
          type: mapDrizzleType(columnData.type),
          isRequired: columnData.notNull,
          isPrimaryKey: columnData.primaryKey,
          hasDefault: columnData.default !== undefined,
          isForeignKey: isForeignKeyColumn(
            columnData.name,
            tableData.foreignKeys || {},
          ),
        }),
      );

      // Parse foreign keys
      const foreignKeys = Object.entries(tableData.foreignKeys || {}).map(
        ([fkKey, fkData]) => ({
          columnName: fkData.columnsFrom[0], // Taking first column for simplicity
          foreignTable: fkData.tableTo,
          name: fkData.name,
        }),
      );

      // Find primary key
      const primaryKeyField = fields.find((f) => f.isPrimaryKey);
      const primaryKey = primaryKeyField ? primaryKeyField.name : "id";

      tables.push({
        exportName,
        tableName,
        singularName: getSingularName(exportName),
        fields,
        foreignKeys,
        primaryKey,
      });
    });

    return tables;
  } catch (error) {
    console.error("❌ Error parsing snapshot:", error.message);
    process.exit(1);
  }
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
      "g",
    );
    const match = exportRegex.exec(schemaContent);

    if (match) {
      return match[1];
    }

    // Fallback: convert table name to camelCase
    return tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  } catch (error) {
    console.warn(
      `⚠️  Could not find export name for table ${tableName}, using fallback`,
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
  if (dbType.includes("[]")) {
    const baseType = dbType.replace("[]", "");
    const mappedType = typeMap[baseType] || "any";
    return `${mappedType}[]`;
  }

  return typeMap[dbType] || "any";
}

/**
 * Check if a column is a foreign key
 */
function isForeignKeyColumn(columnName, foreignKeys) {
  return Object.values(foreignKeys).some(
    (fk) => fk.columnsFrom && fk.columnsFrom.includes(columnName),
  );
}

/**
 * Convert any string to consistent kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
    .replace(/_/g, '-') // snake_case to kebab-case
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
  if (tableName.endsWith("s")) return tableName.slice(0, -1);
  return tableName;
}

/**
 * Generate query files
 */
function generateQueries(tables) {
  console.log("📖 Generating query files...\n");

  if (!fs.existsSync(QUERIES_DIR)) {
    fs.mkdirSync(QUERIES_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  tables.forEach((table) => {
    const {
      exportName,
      tableName,
      singularName,
      fields,
      foreignKeys,
      primaryKey,
    } = table;

    // Create table-specific directory
    const tableDir = path.join(QUERIES_DIR, tableName);
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }

    // 1. Get all items
    const getAllQuery = generateGetAllQuery(exportName, tableName);
    const getAllResult = writeQueryFile(
      tableName,
      `get-all-${toKebabCase(tableName)}.ts`,
      getAllQuery,
    );
    if (getAllResult.created) created++;
    else updated++;

    // 2. Get single item by ID
    const getByIdQuery = generateGetByIdQuery(
      exportName,
      tableName,
      singularName,
      primaryKey,
    );
    const getByIdResult = writeQueryFile(
      tableName,
      `get-${toKebabCase(singularName)}.ts`,
      getByIdQuery,
    );
    if (getByIdResult.created) created++;
    else updated++;

    // 3. Get items by foreign key relationships (singular)
    foreignKeys.forEach((fk) => {
      const getByFkQuery = generateGetByForeignKeyQuery(
        exportName,
        tableName,
        fk,
      );
      const paramName = fk.columnName
        .replace(/Id$/, "")
        .replace(/_id$/, "")
        .replace(/_/g, "");
      const cleanParamName = toKebabCase(paramName);
      const getByFkResult = writeQueryFile(
        tableName,
        `get-${toKebabCase(tableName)}-by-${cleanParamName}.ts`,
        getByFkQuery,
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
        getByFkPluralQuery,
      );
      if (getByFkPluralResult.created) created++;
      else updated++;
    });
  });

  console.log(
    `📖 Query generation complete: ${created} created, ${updated} updated`,
  );
}

/**
 * Generate mutation files
 */
function generateMutations(tables) {
  console.log("✏️  Generating mutation files...\n");

  if (!fs.existsSync(MUTATIONS_DIR)) {
    fs.mkdirSync(MUTATIONS_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  tables.forEach((table) => {
    const { exportName, tableName, singularName, fields, primaryKey } = table;

    // Create table-specific directory
    const tableDir = path.join(MUTATIONS_DIR, tableName);
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }

    // 1. Create single
    const createMutation = generateCreateMutation(
      exportName,
      tableName,
      singularName,
      fields,
    );
    const createResult = writeMutationFile(
      tableName,
      `create-${toKebabCase(singularName)}.ts`,
      createMutation,
    );
    if (createResult.created) created++;
    else updated++;

    // 2. Create multiple
    const createMultipleMutation = generateCreateMultipleMutation(
      exportName,
      tableName,
      singularName,
      fields,
    );
    const createMultipleResult = writeMutationFile(
      tableName,
      `create-${toKebabCase(tableName)}.ts`,
      createMultipleMutation,
    );
    if (createMultipleResult.created) created++;
    else updated++;

    // 3. Update single
    const updateMutation = generateUpdateMutation(
      exportName,
      tableName,
      singularName,
      fields,
      primaryKey,
    );
    const updateResult = writeMutationFile(
      tableName,
      `update-${toKebabCase(singularName)}.ts`,
      updateMutation,
    );
    if (updateResult.created) created++;
    else updated++;

    // 4. Update multiple
    const updateMultipleMutation = generateUpdateMultipleMutation(
      exportName,
      tableName,
      singularName,
      fields,
      primaryKey,
    );
    const updateMultipleResult = writeMutationFile(
      tableName,
      `update-${toKebabCase(tableName)}.ts`,
      updateMultipleMutation,
    );
    if (updateMultipleResult.created) created++;
    else updated++;

    // 5. Delete single
    const deleteMutation = generateDeleteMutation(
      exportName,
      tableName,
      singularName,
      primaryKey,
    );
    const deleteResult = writeMutationFile(
      tableName,
      `delete-${toKebabCase(singularName)}.ts`,
      deleteMutation,
    );
    if (deleteResult.created) created++;
    else updated++;

    // 6. Delete multiple
    const deleteMultipleMutation = generateDeleteMultipleMutation(
      exportName,
      tableName,
      singularName,
      primaryKey,
    );
    const deleteMultipleResult = writeMutationFile(
      tableName,
      `delete-${toKebabCase(tableName)}.ts`,
      deleteMultipleMutation,
    );
    if (deleteMultipleResult.created) created++;
    else updated++;
  });

  console.log(
    `✏️  Mutation generation complete: ${created} created, ${updated} updated`,
  );
}

/**
 * Generate get all query
 */
function generateGetAllQuery(exportName, tableName) {
  return `// utils/queries/${tableName}/get-all-${toKebabCase(tableName)}.ts
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
  return `// utils/queries/${tableName}/get-${toKebabCase(singularName)}.ts
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
  // Get the TypeScript property name from the schema (camelCase)
  const tsPropertyName = getTsPropertyName(foreignKey.columnName);
  const paramName = toCamelCase(tsPropertyName.replace(/Id$/, ""));
  const cleanParamName = toKebabCase(paramName);
  return `// utils/queries/${tableName}/get-${toKebabCase(tableName)}-by-${cleanParamName}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function get${capitalize(exportName)}By${capitalize(paramName)}(${paramName}Id: string) {
  try {
    return await db.select().from(${exportName}).where(eq(${exportName}.${tsPropertyName}, ${paramName}Id));
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
  // Get the TypeScript property name from the schema (camelCase)
  const tsPropertyName = getTsPropertyName(foreignKey.columnName);
  const paramName = toCamelCase(tsPropertyName.replace(/Id$/, ""));
  const pluralParamName = paramName.endsWith("s") ? paramName : paramName + "s";
  const cleanPluralParamName = toKebabCase(pluralParamName);
  return `// utils/queries/${tableName}/get-${toKebabCase(tableName)}-by-${cleanPluralParamName}.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { ${exportName} } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function get${capitalize(exportName)}By${capitalize(pluralParamName)}(${paramName}Ids: string[]) {
  try {
    return await db.select().from(${exportName}).where(inArray(${exportName}.${tsPropertyName}, ${paramName}Ids));
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
  return `// utils/mutations/${tableName}/create-${toKebabCase(singularName)}.ts
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
function generateCreateMultipleMutation(
  exportName,
  tableName,
  singularName,
  fields,
) {
  return `// utils/mutations/${tableName}/create-${toKebabCase(tableName)}.ts
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
function generateUpdateMutation(
  exportName,
  tableName,
  singularName,
  fields,
  primaryKey,
) {
  return `// utils/mutations/${tableName}/update-${toKebabCase(singularName)}.ts
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
function generateUpdateMultipleMutation(
  exportName,
  tableName,
  singularName,
  fields,
  primaryKey,
) {
  return `// utils/mutations/${tableName}/update-${toKebabCase(tableName)}.ts
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
function generateDeleteMutation(
  exportName,
  tableName,
  singularName,
  primaryKey,
) {
  return `// utils/mutations/${tableName}/delete-${toKebabCase(singularName)}.ts
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
function generateDeleteMultipleMutation(
  exportName,
  tableName,
  singularName,
  primaryKey,
) {
  return `// utils/mutations/${tableName}/delete-${toKebabCase(tableName)}.ts
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
function writeQueryFile(tableName, filename, content) {
  const filePath = path.join(QUERIES_DIR, tableName, filename);
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
  const filePath = path.join(MUTATIONS_DIR, tableName, filename);
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
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Main generation function
 */
function generateQueriesAndMutations(options = {}) {
  console.log(
    "🚀 Generating queries and mutations from latest database state...\n",
  );

  // Check for different snapshot generation options
  const skipSnapshot =
    process.argv.includes("--skip-snapshot") || options.skipSnapshot;
  const useSchema =
    process.argv.includes("--from-schema") || options.fromSchema;
  const usePull = process.argv.includes("--pull") || options.pull;

  if (!skipSnapshot) {
    if (usePull) {
      console.log("🔄 Using drizzle-kit pull to get latest database state...");
      pullAndGenerateSnapshot();
    } else if (useSchema) {
      console.log("🔄 Generating snapshot from schema file...");
      generateSnapshotFromSchema();
    } else {
      console.log(
        "🔄 Using drizzle-kit introspect to get latest database state...",
      );
      generateSnapshot();
    }
  } else {
    console.log("⏭️  Skipping snapshot generation (using existing snapshot)\n");
  }

  const tables = extractTableInfo();

  console.log(`📊 Found ${tables.length} tables:`);
  tables.forEach((table) => {
    console.log(
      `  - ${table.exportName} (${table.foreignKeys.length} foreign keys)`,
    );
  });
  console.log("");

  generateQueries(tables);
  console.log("");
  generateMutations(tables);

  console.log("\n✅ Generation complete!");
  console.log("📁 Check utils/queries/ and utils/mutations/ directories");
}

// Run if called directly
if (require.main === module) {
  // Check for help flag
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
🚀 Drizzle Queries & Mutations Generator

Usage: node scripts/generate-queries-mutations.js [options]

Options:
  --skip-snapshot    Skip generating fresh snapshot (use existing one)
  --pull             Use 'drizzle-kit pull' to get latest database state (recommended)
  --from-schema      Generate snapshot from schema file instead of database
  --help, -h         Show this help message

Description:
  This script generates TypeScript query and mutation files based on your database state.
  It uses drizzle-kit's JSON snapshots for reliable parsing instead of regex.

  By default, it will:
  1. Use 'drizzle-kit introspect' to get the latest database state
  2. Parse all tables and relationships from the snapshot
  3. Generate query files (get all, get by ID, get by foreign keys)
  4. Generate mutation files (create, update, delete - both single and multiple)

Examples:
  node scripts/generate-queries-mutations.js                 # Use introspect (default)
  node scripts/generate-queries-mutations.js --pull          # Use pull (recommended for latest DB state)
  node scripts/generate-queries-mutations.js --from-schema   # Generate from schema file
  node scripts/generate-queries-mutations.js --skip-snapshot # Use existing snapshot (faster)

Recommended workflow:
  1. Make database changes (migrations, manual changes, etc.)
  2. Run with --pull to ensure you have the latest database state
  3. Generated queries/mutations will match your actual database structure
`);
    process.exit(0);
  }

  generateQueriesAndMutations();
}

module.exports = { generateQueriesAndMutations, extractTableInfo };
