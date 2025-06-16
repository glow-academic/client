import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // Use environment variables for flexible configuration
    baseUrl: process.env["CYPRESS_baseUrl"] || "http://localhost:3000",

    setupNodeEvents(on: any) {
      // Database-focused node event listeners
      on("task", {
        // Generic database query task for testing database operations
        async dbQuery({
          query,
          params = [],
        }: {
          query: string;
          params?: any[];
        }) {
          const { Client } = await import("pg");

          return new Promise((resolve, reject) => {
            const client = new Client({
              host: process.env["DB_HOST"] || "localhost",
              port: parseInt(process.env["DB_PORT"] || "5432"),
              database: process.env["DB_NAME"] || "mydb",
              user: process.env["DB_USER"] || "myuser",
              password: process.env["DB_PASSWORD"] || "mypassword",
            });

            client
              .connect()
              .then(() => {
                console.log(`Executing query: ${query}`);
                return client.query(query, params);
              })
              .then((result: any) => {
                console.log(
                  `Query executed successfully. Rows affected: ${result.rowCount}`
                );
                return client.end().then(() => result);
              })
              .then((result: any) => resolve(result))
              .catch((error: unknown) => {
                console.error("Database query error:", error);
                client.end();
                reject(error);
              });
          });
        },

        // Specific task for user-class assignment (backward compatibility)
        async assignUserToClass({
          username,
          classId,
        }: {
          username: string;
          classId: string;
        }) {
          const { Client } = await import("pg");

          return new Promise((resolve, reject) => {
            const client = new Client({
              host: process.env["DB_HOST"] || "localhost",
              port: parseInt(process.env["DB_PORT"] || "5432"),
              database: process.env["DB_NAME"] || "mydb",
              user: process.env["DB_USER"] || "myuser",
              password: process.env["DB_PASSWORD"] || "mypassword",
            });

            client
              .connect()
              .then(() => {
                return client.query(
                  "UPDATE users SET class_ids = ARRAY[$1]::UUID[] WHERE username = $2",
                  [classId, username]
                );
              })
              .then((_result: unknown) => {
                console.log(`Assigned user ${username} to class ${classId}`);
                return client.end();
              })
              .then(() => resolve(null))
              .catch((error: unknown) => {
                console.error("Error assigning user to class:", error);
                client.end();
                reject(error);
              });
          });
        },

        // Database health check task
        async dbHealthCheck() {
          const { Client } = await import("pg");

          return new Promise((resolve, reject) => {
            const client = new Client({
              host: process.env["DB_HOST"] || "localhost",
              port: parseInt(process.env["DB_PORT"] || "5432"),
              database: process.env["DB_NAME"] || "mydb",
              user: process.env["DB_USER"] || "myuser",
              password: process.env["DB_PASSWORD"] || "mypassword",
            });

            client
              .connect()
              .then(() => {
                return client.query("SELECT 1 as health_check");
              })
              .then((result: any) => {
                console.log("Database health check passed");
                return client.end().then(() => result);
              })
              .then(() => resolve({ status: "healthy" }))
              .catch((error: unknown) => {
                console.error("Database health check failed:", error);
                client.end();
                reject(error);
              });
          });
        },
      });
    },

    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    experimentalStudio: true,
    retries: {
      runMode: 0, // Retry failed tests in CI
      openMode: 0,
    },
    chromeWebSecurity: false,
    modifyObstructiveCode: false,
    // Enable parallel execution for concurrent testing
    numTestsKeptInMemory: 0,
    // Increase test isolation for thread safety
    testIsolation: true,
  },

  // Environment variables for different environments
  env: {
    // API endpoints - can be overridden by environment
    apiUrl: process.env["CYPRESS_apiUrl"] || "http://localhost:8000",
    // Database connection info
    dbHost: process.env["DB_HOST"] || "localhost",
    dbPort: process.env["DB_PORT"] || "5432",
    dbName: process.env["DB_NAME"] || "mydb",
    dbUser: process.env["DB_USER"] || "myuser",
    dbPassword: process.env["DB_PASSWORD"] || "mypassword",
  },
});
