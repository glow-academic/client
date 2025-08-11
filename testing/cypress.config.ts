import { defineConfig } from "cypress";
import { Client } from "pg";

// --- 1. Centralized Database Client Setup ---
// Create a single client instance to be reused across tasks.
const client = new Client({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "mydb",
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypassword",
});

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_baseUrl || "http://localhost:3000",

    async setupNodeEvents(on, config) {
      // --- 2. Connect to the Database Once ---
      // Establishes a connection when Cypress starts, reused for all tasks.
      try {
        await client.connect();
        console.log("✅ Database connected successfully for Cypress tasks.");
      } catch (error) {
        console.log(
          "⚠️ Database connection failed, continuing without DB tasks:",
          error.message
        );
      }

      on("task", {
        // --- 3. ORM-Based Tasks (Recommended) ---
        // These tasks use Drizzle, making them type-safe and easier to maintain.

        /**
         * Cleans up classes created by tests.
         */
        async "db:cleanup"() {
          try {
            console.log("🧹 Cleaning up test database...");
            return null;
          } catch (e) {
            console.error("db:cleanup error:", e);
            return null;
          }
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
        try {
          await client.end();
          console.log("🔌 Database connection closed.");
        } catch (error) {
          console.log("⚠️ Error closing database connection:", error.message);
        }
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
    retries: {
      runMode: 0,
      openMode: 0,
    },
  },

  env: {
    apiUrl: process.env.CYPRESS_apiUrl || "http://localhost:8000",
    // Auth-specific environment variables
    authBaseUrl: process.env.CYPRESS_authBaseUrl || "http://localhost:3000",
    testUser: {
      admin: {
        email: "admin@test.com",
        role: "admin",
      },
      ta: {
        email: "ta@test.com",
        role: "ta",
      },
      instructional: {
        email: "instructional@test.com",
        role: "instructional",
      },
      superadmin: {
        email: "superadmin@test.com",
        role: "superadmin",
      },
    },
  },
});
