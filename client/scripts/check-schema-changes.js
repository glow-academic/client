#!/usr/bin/env node

import { execSync, spawn } from "child_process";
import { existsSync } from "fs";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function checkSchemaChanges() {
  console.log("🔍 Checking for schema changes...");

  try {
    // Check if drizzle config exists
    if (!existsSync("drizzle.config.ts")) {
      console.log("⚠️  No drizzle.config.ts found, skipping schema check");
      return;
    }

    // Run drizzle-kit check to see if there are pending changes
    try {
      execSync("npx drizzle-kit check", { stdio: "pipe" });
      console.log("✅ Schema is up to date");
      return;
    } catch (error) {
      // If check fails, there might be schema changes
      const output = error.stdout?.toString() || error.stderr?.toString() || "";

      if (
        output.includes("No schema changes found") ||
        output.includes("up to date")
      ) {
        console.log("✅ Schema is up to date");
        return;
      }

      console.log("⚠️  Schema changes detected!");
      console.log("📋 Your database schema differs from your Drizzle schema.");

      const answer = await askQuestion(
        "🤔 Would you like to generate a migration? (y/N): "
      );

      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        console.log("🚀 Generating migration...");

        // Run drizzle-kit generate interactively
        const generateProcess = spawn("npx", ["drizzle-kit", "generate"], {
          stdio: "inherit",
          shell: true,
        });

        await new Promise((resolve, reject) => {
          generateProcess.on("close", (code) => {
            if (code === 0) {
              console.log("✅ Migration generated successfully!");

              // Copy migration to database directory
              try {
                const latestMigration = execSync(
                  "ls -t drizzle/*.sql | head -n1",
                  { encoding: "utf8" }
                ).trim();
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

              resolve();
            } else {
              reject(
                new Error(`Migration generation failed with code ${code}`)
              );
            }
          });
        });
      } else {
        console.log("⏭️  Skipping migration generation");
        console.log(
          '💡 You can run "npx drizzle-kit generate" later if needed'
        );
      }
    }
  } catch (error) {
    console.log("⚠️  Could not check schema changes:", error.message);
    console.log("💡 Continuing with development...");
  } finally {
    rl.close();
  }
}

// Run the check
checkSchemaChanges().catch((error) => {
  console.error("❌ Error checking schema changes:", error);
  process.exit(1);
});
