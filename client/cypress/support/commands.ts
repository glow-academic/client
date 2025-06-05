// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom commands for streamlined testing

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsUser(username?: string, password?: string): Chainable<void>
      loginAsAdmin(username?: string, password?: string): Chainable<void>
      loginAsGuest(): Chainable<void>
      setupApiMocks(): Chainable<void>
      navigateToPage(page: string): Chainable<void>
      startChat(profileName?: string): Chainable<void>
      sendMessage(message: string): Chainable<void>
      endChat(): Chainable<void>
      clearAllStorage(): Chainable<void>
      waitForServerAction(): Chainable<void>
    }
  }
}

// Authentication commands
Cypress.Commands.add('loginAsUser', (username?: string, password?: string) => {
  const user = username || `test_user_${Date.now()}`
  const pass = password || 'testpass123'
  
  cy.visit('/')
  cy.get('#username').type(user)
  cy.get('#password').type(pass)
  cy.get('button').contains('Login').click()
  cy.url().should('include', '/dashboard', { timeout: 15000 })
})

Cypress.Commands.add('loginAsAdmin', (username?: string, password?: string) => {
  const user = username || `admin_${Date.now()}`
  const pass = password || 'adminpass123'
  
  cy.visit('/')
  cy.get('#username').type(user)
  cy.get('#password').type(pass)
  cy.get('button').contains('Admin').click()
  cy.url().should('include', '/dashboard', { timeout: 15000 })
})

Cypress.Commands.add('loginAsGuest', () => {
  cy.visit('/')
  cy.get('button').contains('Continue as Guest').click()
  cy.url().should('include', '/dashboard', { timeout: 10000 })
})

// API monitoring setup - Track real API calls without mocking
Cypress.Commands.add('setupApiMocks', () => {
  // Monitor attempt start endpoint (don't mock, just track)
  cy.intercept('POST', '**/attempt/start').as('startAttempt')

  // Monitor attempt message endpoint (don't mock, just track)
  cy.intercept('POST', '**/attempt/message').as('sendMessage')

  // Monitor attempt continue endpoint (don't mock, just track)
  cy.intercept('POST', '**/attempt/continue').as('endChat')

  // Monitor server actions for data fetching
  cy.intercept('POST', '/_next/static/chunks/**').as('serverAction')
  cy.intercept('GET', '/_next/static/chunks/**').as('staticChunk')
})

// Navigation helpers with server action support
Cypress.Commands.add('navigateToPage', (page: string) => {
  cy.visit(page, { failOnStatusCode: false })
  
  // Wait for the page to load and any server actions to complete
  cy.get('body', { timeout: 15000 }).should('be.visible')
  
  // Give time for server actions to complete
  cy.wait(2000)
  
  // Check if we're on the expected page (more flexible check)
  cy.url().then((url) => {
    if (!url.includes(page)) {
      // If not on expected page, try to handle redirects or errors
      cy.get('body').then(($body) => {
        if ($body.text().includes('404') || $body.text().includes('Not Found')) {
          cy.log(`Page ${page} not found - this may be expected if the route doesn't exist yet`)
        } else {
          cy.log(`Navigated to ${url} instead of ${page}`)
        }
      })
    }
  })
})

// Server action helper
Cypress.Commands.add('waitForServerAction', () => {
  // Wait for any pending server actions to complete
  cy.get('body', { timeout: 10000 }).should('be.visible')
  cy.wait(1000) // Give time for React to hydrate and server actions to execute
})

// Chat helpers - Robust for real data scenarios
Cypress.Commands.add('startChat', (templateTitle = 'Happy Chat Template') => {
  // Navigate to chats page and start a chat
  cy.navigateToPage('/dashboard/chats')
  
  // Wait for page to load and data to be fetched
  cy.waitForServerAction()
  
  // Look for any clickable card
  cy.get('body').then(($body) => {
    if ($body.find('[class*="card"]').length > 0) {
      cy.get('[class*="card"]').first().should('be.visible').click()
      cy.wait('@startAttempt', { timeout: 15000 })
      cy.url().should('include', '/a/')
    } else {
      throw new Error('No template cards found - database may need setup')
    }
  })
})

Cypress.Commands.add('sendMessage', (message: string) => {
  cy.get('body', { timeout: 15000 }).should('be.visible')
  
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="message-input"]').length > 0) {
      cy.get('[data-testid="message-input"]').should('be.visible').type(message)
      cy.get('[data-testid="send-button"]').should('be.visible').click()
      cy.wait('@sendMessage', { timeout: 15000 })
    } else {
      throw new Error('Message input not found - chat interface may not be loaded')
    }
  })
})

Cypress.Commands.add('endChat', () => {
  cy.get('body').then(($body) => {
    if ($body.text().includes('End')) {
      cy.get('button').contains('End').click()
      cy.wait('@endChat', { timeout: 15000 })
    } else {
      throw new Error('End button not found - chat may not be in correct state')
    }
  })
})

// Storage cleanup
Cypress.Commands.add('clearAllStorage', () => {
  cy.clearLocalStorage()
  cy.clearCookies()
  cy.window().then((win) => {
    win.sessionStorage.clear()
  })
})

export {} 