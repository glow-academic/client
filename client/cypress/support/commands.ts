// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command to login as a regular user
Cypress.Commands.add('loginAsUser', (username: string, password: string) => {
  cy.visit('/')
  cy.get('#username').type(username)
  cy.get('#password').type(password)
  cy.get('button').contains('Login').click()
  // Wait for redirect to complete
  cy.url().should('include', '/home', { timeout: 10000 })
})

// Custom command to login as an admin
Cypress.Commands.add('loginAsAdmin', (username: string, password: string) => {
  cy.visit('/')
  cy.get('#username').type(username)
  cy.get('#password').type(password)
  cy.get('button').contains('Admin').click()
  // Wait for redirect to complete
  cy.url().should('include', '/home', { timeout: 10000 })
})

// Custom command to access as guest
Cypress.Commands.add('accessAsGuest', () => {
  cy.visit('/')
  cy.get('button').contains('Continue as Guest').click()
  // Wait for redirect to complete
  cy.url().should('include', '/home', { timeout: 10000 })
})

// Custom command to clear all storage
Cypress.Commands.add('clearAllStorage', () => {
  cy.clearLocalStorage()
  cy.clearCookies()
  cy.window().then((win) => {
    win.sessionStorage.clear()
  })
}) 