#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const SCHEMA_PATH = path.join(__dirname, "../drizzle/schema.ts");
const CLIENT_SCHEMA_PATH = path.join(
  __dirname,
  "../../client/utils/drizzle/schema.ts"
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

    // Copy cleaned schema to client
    copySchemaToClient(schemaContent);
  } catch (error) {
    console.error("❌ Error cleaning schema:", error.message);
    process.exit(1);
  }
}

/**
 * Copy cleaned schema to client directory
 */
function copySchemaToClient(schemaContent) {
  console.log("📋 Copying cleaned schema to client...");

  try {
    // Ensure client drizzle directory exists
    const clientDrizzleDir = path.dirname(CLIENT_SCHEMA_PATH);
    if (!fs.existsSync(clientDrizzleDir)) {
      fs.mkdirSync(clientDrizzleDir, { recursive: true });
      console.log("📁 Created client drizzle directory");
    }

    // Write schema to client
    fs.writeFileSync(CLIENT_SCHEMA_PATH, schemaContent);
    console.log(`✅ Schema copied to ${CLIENT_SCHEMA_PATH}`);
  } catch (error) {
    console.error("❌ Error copying schema to client:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanSchema();
}

export { cleanSchema };
