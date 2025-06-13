#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const SCHEMA_PATH = path.join(__dirname, "../drizzle/schema.ts");
const CLIENT_MIGRATIONS_PATH = path.join(__dirname, "../drizzle");
const DATABASE_MIGRATIONS_PATH = path.join(
  __dirname,
  "../../database/migrations"
);

/**
 * Clean unused imports from schema file
 */
function cleanSchema() {
  console.log("🧹 Cleaning unused imports from schema...");

  try {
    let schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");
    let hasChanges = false;

    // List of imports to check for usage
    const importsToCheck = ["sql"];

    for (const importName of importsToCheck) {
      // Check if import is actually used in the file (excluding import statements)
      const usageRegex = new RegExp(
        `\\b${importName}\\b(?!\\s*[}\\s]*from)`,
        "g"
      );
      const lines = schemaContent.split("\n");

      // Find usage outside of import statements
      let isUsed = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip import lines
        if (line.trim().startsWith("import")) continue;

        if (usageRegex.test(line)) {
          isUsed = true;
          break;
        }
      }

      if (!isUsed) {
        console.log(`📝 Removing unused '${importName}' import...`);

        // Remove standalone import line
        const standaloneImportRegex = new RegExp(
          `import\\s*{\\s*${importName}\\s*}\\s*from\\s*["'][^"']*["']\\s*;?\\s*\\n?`,
          "g"
        );
        schemaContent = schemaContent.replace(standaloneImportRegex, "");

        // Remove from multi-import lines
        const multiImportRegex = new RegExp(
          `(import\\s*{[^}]*),\\s*${importName}\\s*([^}]*}\\s*from\\s*["'][^"']*["'])`,
          "g"
        );
        schemaContent = schemaContent.replace(multiImportRegex, "$1$2");

        // Remove if it's the first item in multi-import
        const firstItemRegex = new RegExp(
          `(import\\s*{)\\s*${importName}\\s*,\\s*([^}]*}\\s*from\\s*["'][^"']*["'])`,
          "g"
        );
        schemaContent = schemaContent.replace(firstItemRegex, "$1 $2");

        // Clean up any double commas or extra spaces
        schemaContent = schemaContent.replace(/,\s*,/g, ",");
        schemaContent = schemaContent.replace(/{\s*,/g, "{");
        schemaContent = schemaContent.replace(/,\s*}/g, "}");

        hasChanges = true;
      }
    }

    if (hasChanges) {
      // Clean up any extra blank lines
      schemaContent = schemaContent.replace(/\n\n\n+/g, "\n\n");

      fs.writeFileSync(SCHEMA_PATH, schemaContent);
      console.log("✅ Schema cleaned successfully!");
    } else {
      console.log("ℹ️  No unused imports found in schema");
    }
  } catch (error) {
    console.error("❌ Error cleaning schema:", error.message);
    process.exit(1);
  }
}

/**
 * Copy migration files and schema files from client to database directory
 */
function copyFilesToDatabase() {
  console.log("📋 Copying files to database directory...");

  try {
    // Check if client drizzle directory exists
    if (!fs.existsSync(CLIENT_MIGRATIONS_PATH)) {
      console.log("ℹ️  No client drizzle directory found, skipping copy");
      return;
    }

    // Create database migrations directory if it doesn't exist
    if (!fs.existsSync(DATABASE_MIGRATIONS_PATH)) {
      fs.mkdirSync(DATABASE_MIGRATIONS_PATH, { recursive: true });
      console.log("📁 Created database migrations directory");
    }

    // Get all files from client drizzle directory
    const files = fs.readdirSync(CLIENT_MIGRATIONS_PATH);

    // Filter for files we want to copy: SQL files, schema.ts, and relations.ts
    const filesToCopy = files.filter(
      (file) =>
        file.endsWith(".sql") || file === "schema.ts" || file === "relations.ts"
    );

    if (filesToCopy.length === 0) {
      console.log("ℹ️  No files found to copy");
      return;
    }

    let copiedCount = 0;
    let skippedCount = 0;

    for (const file of filesToCopy) {
      const sourcePath = path.join(CLIENT_MIGRATIONS_PATH, file);
      const destPath = path.join(DATABASE_MIGRATIONS_PATH, file);

      // Check if file already exists in destination
      if (fs.existsSync(destPath)) {
        // Compare file contents to see if they're different
        const sourceContent = fs.readFileSync(sourcePath, "utf8");
        const destContent = fs.readFileSync(destPath, "utf8");

        if (sourceContent === destContent) {
          console.log(`⏭️  Skipping ${file} (already exists and identical)`);
          skippedCount++;
          continue;
        } else {
          console.log(`🔄 Updating ${file} (content differs)`);
        }
      } else {
        console.log(`📄 Copying ${file}`);
      }

      // Copy the file
      fs.copyFileSync(sourcePath, destPath);
      copiedCount++;
    }

    if (copiedCount > 0) {
      console.log(`✅ Successfully copied/updated ${copiedCount} file(s)`);
    }
    if (skippedCount > 0) {
      console.log(`ℹ️  Skipped ${skippedCount} identical file(s)`);
    }

    // Also copy the meta directory if it exists
    const clientMetaPath = path.join(CLIENT_MIGRATIONS_PATH, "meta");
    const databaseMetaPath = path.join(DATABASE_MIGRATIONS_PATH, "meta");

    if (fs.existsSync(clientMetaPath)) {
      if (!fs.existsSync(databaseMetaPath)) {
        fs.mkdirSync(databaseMetaPath, { recursive: true });
      }

      const metaFiles = fs.readdirSync(clientMetaPath);
      let metaCopiedCount = 0;

      for (const metaFile of metaFiles) {
        const sourceMetaPath = path.join(clientMetaPath, metaFile);
        const destMetaPath = path.join(databaseMetaPath, metaFile);

        // Only copy if file doesn't exist or is different
        if (!fs.existsSync(destMetaPath)) {
          fs.copyFileSync(sourceMetaPath, destMetaPath);
          metaCopiedCount++;
        } else {
          const sourceContent = fs.readFileSync(sourceMetaPath, "utf8");
          const destContent = fs.readFileSync(destMetaPath, "utf8");

          if (sourceContent !== destContent) {
            fs.copyFileSync(sourceMetaPath, destMetaPath);
            metaCopiedCount++;
          }
        }
      }

      if (metaCopiedCount > 0) {
        console.log(`📁 Copied/updated ${metaCopiedCount} meta file(s)`);
      }
    }
  } catch (error) {
    console.error("❌ Error copying files:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanSchema();
  copyFilesToDatabase();
}

export { cleanSchema, copyFilesToDatabase };
