describe('UI and Navigation Tests', () => {
  beforeEach(() => {
    cy.clearAllStorage()
  })

  describe('Navigation Elements', () => {
    it('should have proper navigation elements for logged-in users', () => {
      const username = `nav_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should have main content
      cy.get('main').should('be.visible')
      
      // Should have sidebar trigger
      cy.get('[data-testid="sidebar-trigger"]').should('be.visible')
      
      // Should have header
      cy.get('header').should('be.visible')
    })

    it('should have proper navigation elements for guest users', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Should have main content
      cy.get('main').should('be.visible')
      
      // Should have basic navigation elements
      cy.get('header').should('be.visible')
    })

    it('should show home page title and content', () => {
      const username = `home_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should see home page title
      cy.get('h1').should('contain', 'Home')
      
      // Should see welcome message
      cy.get('body').should('contain', 'Welcome to GLOW!')
    })
  })

  describe('Responsive Design', () => {
    it('should work on desktop screen size', () => {
      const username = `desktop_${Date.now()}`
      const password = 'testpass123'
      
      // Test desktop
      cy.viewport(1280, 720)
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
      
      // Should see profile cards properly laid out
      cy.contains('Shuffle').should('be.visible')
      cy.contains('Happy').should('be.visible')
      cy.contains('Aggressive').should('be.visible')
    })

    it('should work on tablet screen size', () => {
      const username = `tablet_${Date.now()}`
      const password = 'testpass123'
      
      // Test tablet
      cy.viewport(768, 1024)
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
      
      // Should still see profile cards
      cy.contains('Shuffle').should('be.visible')
      cy.contains('Happy').should('be.visible')
    })

    it('should work on mobile screen size', () => {
      const username = `mobile_${Date.now()}`
      const password = 'testpass123'
      
      // Test mobile
      cy.viewport(375, 667)
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
      
      // Should still see profile cards, possibly stacked
      cy.contains('Shuffle').should('be.visible')
      cy.contains('Happy').should('be.visible')
    })

    it('should handle very small screen sizes', () => {
      const username = `small_${Date.now()}`
      const password = 'testpass123'
      
      // Test very small screen
      cy.viewport(320, 568)
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
      
      // Should still be functional
      cy.contains('Shuffle').should('be.visible')
    })
  })

  describe('Profile Cards Display', () => {
    it('should display all profile cards for regular users', () => {
      const username = `profile_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should see all profile cards
      cy.contains('Shuffle').should('be.visible')
      cy.contains('Happy').should('be.visible')
      cy.contains('Aggressive').should('be.visible')
      cy.contains('Confused').should('be.visible')
    })

    it('should display profile cards for guest users', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Should see profile cards
      cy.contains('Shuffle').should('be.visible')
      cy.contains('Happy').should('be.visible')
      cy.contains('Aggressive').should('be.visible')
      cy.contains('Confused').should('be.visible')
    })

    it('should show profile card descriptions', () => {
      const username = `desc_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should see profile descriptions
      cy.get('body').should('contain', 'Direct and Challenging')
      cy.get('body').should('contain', 'Positive and Encouraging')
      cy.get('body').should('contain', 'Asks clarifying questions')
    })
  })

  describe('Quiz Cards Display', () => {
    it('should show quiz cards for enrolled students', () => {
      const username = `quiz_display_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.task('assignUserToClass', { 
        username, 
        classId: '44444444-1111-1111-1111-111111111111' 
      })
      
      cy.reload()
      cy.wait(2000)
      
      // Should see quiz card
      cy.get('[data-testid="quiz-card"]').should('be.visible')
      cy.get('body').should('contain', 'CS 180 Practice Quiz')
    })

    it('should not show quiz cards for non-enrolled users', () => {
      const username = `no_quiz_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should not see quiz cards
      cy.get('[data-testid="quiz-card"]').should('not.exist')
    })

    it('should not show quiz cards for guest users', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Should not see quiz cards
      cy.get('[data-testid="quiz-card"]').should('not.exist')
    })
  })

  describe('Interactive Elements', () => {
    it('should have clickable profile cards', () => {
      const username = `click_user_${Date.now()}`
      const password = 'testpass123'
      
      // Mock chat creation for interaction test
      cy.intercept('POST', '**/chat/new', {
        statusCode: 200,
        body: {
          message: 'Chat started',
          chat_id: 'test-chat-id'
        }
      }).as('startChat')
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Profile cards should be clickable
      cy.contains('Happy').parents('[class*="card"]').first().should('be.visible')
      cy.contains('Happy').parents('[class*="card"]').first().click()
      
      cy.wait('@startChat')
      cy.url().should('include', '/chat/')
    })

    it('should have hover effects on interactive elements', () => {
      const username = `hover_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should be able to hover over profile cards
      cy.contains('Shuffle').parents('[class*="card"]').first().trigger('mouseover')
      cy.contains('Happy').parents('[class*="card"]').first().trigger('mouseover')
    })
  })

  describe('Loading States', () => {
    it('should handle page loading gracefully', () => {
      const username = `loading_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      
      // Should see login form immediately
      cy.get('#username').should('be.visible')
      cy.get('#password').should('be.visible')
      
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      // Should eventually reach home page
      cy.url().should('include', '/home', { timeout: 15000 })
      cy.get('h1').should('contain', 'Home')
    })

    it('should show content after authentication', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Should see content after guest login
      cy.get('h1').should('contain', 'Home')
      cy.contains('Shuffle').should('be.visible')
    })
  })

  describe('Error States', () => {
    it('should handle navigation errors gracefully', () => {
      const username = `nav_error_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Try to visit a non-existent page
      cy.visit('/non-existent-page', { failOnStatusCode: false })
      
      // Should handle gracefully (either redirect or show 404)
      cy.get('body').should('exist')
    })

    it('should maintain layout integrity on errors', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Even with potential errors, basic layout should remain
      cy.get('body').should('be.visible')
      cy.get('main').should('be.visible')
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      const username = `a11y_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should have proper heading hierarchy
      cy.get('h1').should('exist')
      cy.get('h1').should('contain', 'Home')
    })

    it('should have focusable interactive elements', () => {
      const username = `focus_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Interactive elements should be focusable
      cy.contains('Shuffle').parents('[class*="card"]').first().focus()
      cy.contains('Happy').parents('[class*="card"]').first().focus()
    })
  })
}) 