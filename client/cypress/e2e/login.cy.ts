describe('Authentication Tests', () => {
  beforeEach(() => {
    cy.clearAllStorage()
  })

  it('should successfully login as guest', () => {
    cy.visit('/')
    cy.get('button').contains('Continue as Guest').click()
    cy.url().should('include', '/home', { timeout: 10000 })
    cy.window().its('localStorage').invoke('getItem', 'guestMode').should('equal', 'true')
    cy.get('h1').should('contain', 'Home')
  })

  it('should successfully create and login new user', () => {
    const username = `testuser_${Date.now()}`
    const password = 'testpass123'
    
    cy.visit('/')
    cy.get('#username').type(username)
    cy.get('#password').type(password)
    cy.get('button').contains('Login').click()
    
    cy.url().should('include', '/home', { timeout: 15000 })
    cy.get('h1').should('contain', 'Home')
  })

  it('should successfully create and login new admin', () => {
    const username = `admin_${Date.now()}`
    const password = 'adminpass123'
    
    cy.visit('/')
    cy.get('#username').type(username)
    cy.get('#password').type(password)
    cy.get('button').contains('Admin').click()
    
    cy.url().should('include', '/home', { timeout: 15000 })
    cy.get('h1').should('contain', 'Home')
  })

  it('should show proper login form elements', () => {
    cy.visit('/')
    
    // Should have username and password inputs
    cy.get('#username').should('be.visible')
    cy.get('#password').should('be.visible')
    
    // Should have all three buttons
    cy.get('button').contains('Login').should('be.visible')
    cy.get('button').contains('Admin').should('be.visible')
    cy.get('button').contains('Continue as Guest').should('be.visible')
  })
}) 