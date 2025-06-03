describe('Authentication Tests', () => {
  beforeEach(() => {
    cy.clearAllStorage()
  })

  describe('User Authentication', () => {
    it('should successfully login as regular user', () => {
      const username = `test_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
    })

    it('should successfully login as admin', () => {
      const username = `admin_${Date.now()}`
      const password = 'adminpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Admin').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
    })

    it('should successfully access as guest', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      cy.get('h1').should('contain', 'Home')
      cy.window().its('localStorage').invoke('getItem', 'guestMode').should('equal', 'true')
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

  describe('Guest User Restrictions', () => {
    it('should show limited content for guest users', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Should see welcome message
      cy.get('body').should('contain', 'Welcome to GLOW!')
      
      // Should see profile cards but no quiz cards
      cy.contains('Shuffle').should('be.visible')
      cy.contains('Happy').should('be.visible')
      
      // Should not see quiz-related content
      cy.get('[data-testid="quiz-card"]').should('not.exist')
    })

    it('should allow guest to start chat', () => {
      // Mock chat creation
      cy.intercept('POST', '**/chat/new', {
        statusCode: 200,
        body: {
          message: 'Chat started',
          chat_id: 'test-chat-id'
        }
      }).as('startChat')

      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Click on a profile card
      cy.contains('Happy').parents('[class*="card"]').first().click()
      
      cy.wait('@startChat')
      cy.url().should('include', '/chat/')
    })
  })
}) 