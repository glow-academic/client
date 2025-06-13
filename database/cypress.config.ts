import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on) {
      // implement node event listeners here
      on("task", {
        assignUserToClass({
          username,
          classId,
        }: {
          username: string;
          classId: string;
        }) {
          // Use node-postgres to update the user's class_ids
          const { Client } = require("pg");

          return new Promise((resolve, reject) => {
            const client = new Client({
              host: "localhost",
              port: 5432,
              database: "mydb",
              user: "myuser",
              password: "mypassword",
            });

            client
              .connect()
              .then(() => {
                return client.query(
                  "UPDATE users SET class_ids = ARRAY[$1]::UUID[] WHERE username = $2",
                  [classId, username],
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
      runMode: 0,
      openMode: 0,
    },
    chromeWebSecurity: false,
    modifyObstructiveCode: false,
    // Enable parallel execution for concurrent testing
    numTestsKeptInMemory: 0,
    // Increase test isolation for thread safety
    testIsolation: true,
  },
  // Component testing configuration (if needed)
  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },
});
