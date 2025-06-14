#!/usr/bin/env node

import { execSync, spawn } from "child_process";
import { existsSync } from "fs";


async function runCommand(command, args, description) {
  console.log(`🚀 ${description}...`);

  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${description} failed with code ${code}`));
      }
    });
  });
}

async function checkForMigrationGenerated() {
  try {
    // Check if a new migration file was created in the last minute
    const result = execSync(
      'find drizzle -name "*.sql" -newermt "1 minute ago" | wc -l',
      { encoding: "utf8" }
    );
    return parseInt(result.trim()) > 0;
  } catch {
    return false;
  }
}

async function checkSchemaChanges() {
  console.log("🔍 Checking for schema changes...");

  try {
    // Check if drizzle config exists
    if (!existsSync("drizzle.config.ts")) {
      console.log("⚠️  No drizzle.config.ts found, skipping schema check");
      return;
    }

    // Step 1: Pull latest schema from database
    await runCommand(
      "npx",
      ["drizzle-kit", "pull"],
      "Syncing schema from database"
    );

    // Step 2: Generate migrations if there are changes
    await runCommand(
      "npx",
      ["drizzle-kit", "generate"],
      "Checking for migration generation"
    );

    // Step 3: Check if a migration was actually generated
    const hasChanges = await checkForMigrationGenerated();

    if (hasChanges) {
      console.log("✅ Migration generated successfully!");

      // Copy migration to database directory
      try {
        const latestMigration = execSync("ls -t drizzle/*.sql | head -n1", {
          encoding: "utf8",
        }).trim();
        if (latestMigration) {
          execSync(`cp "${latestMigration}" ../database/migrations/`);
          console.log("📁 Migration copied to database/migrations/");
        }
      } catch (copyError) {
        console.log(
          "⚠️  Could not copy migration to database directory:",
          copyError.message
        );
      }
    } else {
      console.log(
        "✅ No schema changes detected - continuing with development"
      );
    }
  } catch (error) {
    console.log("⚠️  Could not check schema changes:", error.message);
    console.log("💡 Continuing with development...");
  }
}

// Run the check
checkSchemaChanges().catch((error) => {
  console.error("❌ Error checking schema changes:", error);
  process.exit(1);
});
