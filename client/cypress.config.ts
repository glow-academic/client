import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        assignUserToClass({ username, classId }: { username: string, classId: string }) {
          // Use node-postgres to update the user's class_ids
          const { Client } = require('pg')
          
          return new Promise((resolve, reject) => {
            const client = new Client({
              host: 'localhost',
              port: 5432,
              database: 'mydb',
              user: 'myuser',
              password: 'mypassword',
            })
            
            client.connect()
              .then(() => {
                return client.query(
                  'UPDATE users SET class_ids = ARRAY[$1]::UUID[] WHERE username = $2',
                  [classId, username]
                )
              })
              .then((_result: any) => {
                console.log(`Assigned user ${username} to class ${classId}`)
                return client.end()
              })
              .then(() => resolve(null))
              .catch((error: any) => {
                console.error('Error assigning user to class:', error)
                client.end()
                reject(error)
              })
          })
        }
      })
    },
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
  },
}) 