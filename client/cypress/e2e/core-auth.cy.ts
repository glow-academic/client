describe('Core Authentication', () => {
  beforeEach(() => {
    cy.clearAllStorage()
  })

  it('should display login form', () => {
    cy.visit('/')
    cy.get('h1').should('contain', 'Glow')
    cy.get('#username').should('be.visible')
    cy.get('#password').should('be.visible')
    cy.get('button').contains('Login').should('be.visible')
    cy.get('button').contains('Admin').should('be.visible')
    cy.get('button').contains('Continue as Guest').should('be.visible')
  })

  it('should login as regular user', () => {
    cy.loginAsUser()
    cy.url().should('include', '/dashboard')
  })

  it('should login as admin', () => {
    cy.loginAsAdmin()
    cy.url().should('include', '/dashboard')
  })

  it('should continue as guest', () => {
    cy.loginAsGuest()
    cy.url().should('include', '/dashboard')
    cy.window().its('localStorage').invoke('getItem', 'guestMode').should('equal', 'true')
  })

  it('should logout user', () => {
    cy.loginAsUser()
    cy.url().should('include', '/dashboard')
    
    // Wait for the page to fully load
    cy.wait(1000)
    
    // Find the user profile button (contains avatar and user info)
    cy.get('button').contains('test_user').click()
    
    // Click on the Log Out menu item in the dropdown
    cy.contains('Logout').click()
    
    // Should redirect to login page
    cy.url().should('not.include', '/dashboard')
    cy.url().should('eq', Cypress.config().baseUrl + '/')
  })

  it('should show error for invalid credentials', () => {
    cy.visit('/')
    cy.get('#username').type('invalid_user')
    cy.get('#password').type('wrong_password')
    cy.get('button').contains('Login').click()
    
    // Should show error message
    cy.get('body').then(($body) => {
      expect($body.text().toLowerCase()).to.match(/(error|invalid|failed)/)
    })
  })
}) 