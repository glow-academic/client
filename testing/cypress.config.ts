import { defineConfig } from "cypress";
import { eq, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { classes } from "./drizzle/schema"; // Adjust path to your Drizzle schema

// --- 1. Centralized Database Client Setup ---
// Create a single client instance to be reused across tasks.
const client = new Client({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "mydb",
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypassword",
});

// Create a Drizzle instance using the client.
const db = drizzle(client);

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_baseUrl || "http://localhost:3000",

    async setupNodeEvents(on, config) {
      // --- 2. Connect to the Database Once ---
      // Establishes a connection when Cypress starts, reused for all tasks.
      await client.connect();
      console.log("✅ Database connected successfully for Cypress tasks.");

      on("task", {
        // --- 3. ORM-Based Tasks (Recommended) ---
        // These tasks use Drizzle, making them type-safe and easier to maintain.

        /**
         * Cleans up classes created by tests.
         */
        async "db:cleanup"() {
          try {
            console.log("🧹 Cleaning up test database...");
            await db
              .delete(classes)
              .where(ilike(classes.name, "Intro to Testing%"));
            return null;
          } catch (e) {
            console.error("db:cleanup error:", e);
            return null;
          }
        },

        /**
         * Finds a class by name using the Drizzle ORM.
         */
        async "db:findClass"({ name }: { name: string }) {
          console.log(`🔎 Searching for class: ${name}`);
          const result = await db
            .select()
            .from(classes)
            .where(eq(classes.name, name));
          return result[0] || null;
        },

        // --- 4. Generic Raw SQL Query Task (Utility) ---
        // A fallback for running raw SQL if needed, now much cleaner.
        async "db:query"({
          query,
          params = [],
        }: {
          query: string;
          params?: any[];
        }) {
          console.log(`Executing raw query: ${query}`);
          const result = await client.query(query, params);
          return result.rows;
        },
      });

      // Disconnect the client when the browser is closed.
      on("after:run", async () => {
        await client.end();
        console.log("🔌 Database connection closed.");
      });
    },

    // Your other Cypress configurations...
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    testIsolation: true,
  },

  env: {
    apiUrl: process.env.CYPRESS_apiUrl || "http://localhost:8000",
  },
});
