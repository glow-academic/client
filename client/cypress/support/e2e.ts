// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login as a regular user
       * @example cy.loginAsUser('testuser', 'password123')
       */
      loginAsUser(username: string, password: string): Chainable<void>
      
      /**
       * Custom command to login as an admin
       * @example cy.loginAsAdmin('admin', 'adminpass')
       */
      loginAsAdmin(username: string, password: string): Chainable<void>
      
      /**
       * Custom command to access as guest
       * @example cy.accessAsGuest()
       */
      accessAsGuest(): Chainable<void>
      
      /**
       * Custom command to clear all storage
       * @example cy.clearAllStorage()
       */
      clearAllStorage(): Chainable<void>
    }
  }
} 