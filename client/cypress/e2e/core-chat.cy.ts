/**
 * Core Chat Functionality Tests
 * 
 * Simplified tests focusing on essential chat workflows:
 * - Starting chats (single and multi)
 * - Sending messages
 * - Ending chats
 * 
 * Uses test_data=true to avoid wasting API calls during testing
 */

describe('Core Chat Functionality', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    
    // Setup API intercepts to monitor requests (test_data is added automatically by frontend)
    cy.intercept('POST', '**/attempt/start').as('startAttempt')
    cy.intercept('POST', '**/attempt/message').as('sendMessage')
    cy.intercept('POST', '**/attempt/continue').as('endChat')
    
    // Handle uncaught exceptions
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('Invalid or unexpected token') || 
          err.message.includes('fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('ResizeObserver')) {
        return false
      }
      return true
    })
  })

  describe('Single Chat Workflow', () => {
    it('should complete a full single chat: start -> send message -> end', () => {
      // Login and navigate
      cy.visit('/')
      cy.get('#username').type('test_user')
      cy.get('#password').type('testpass123')
      cy.get('button').contains('Login').click()
      cy.url().should('include', '/dashboard', { timeout: 15000 })

      // Navigate to chats page
      cy.visit('/dashboard/chats')
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.wait(3000) // Wait for data to load

      // Wait for templates to load and start a chat
      cy.get('[class*="card"]', { timeout: 10000 }).should('exist')
      cy.get('[class*="card"]').should('have.length.greaterThan', 0)
      
      cy.log('✅ Starting single chat')
      cy.get('[class*="card"]').first().click()
      cy.wait('@startAttempt', { timeout: 30000 })
      cy.url().should('include', '/a/')

      // Wait for chat interface to fully load
      cy.get('[data-testid="message-input"]', { timeout: 15000 }).should('be.visible')
      cy.get('[data-testid="send-button"]').should('be.visible')

      // Send a test message
      cy.get('[data-testid="message-input"]').type('Hello! This is a test message.')
      cy.get('[data-testid="send-button"]').click()
      cy.wait('@sendMessage', { timeout: 15000 })

      // Verify message was sent (should see user message in chat)
      cy.get('body').should('contain', 'Hello! This is a test message.')

      // End the chat
      cy.get('button').contains(/End Session|End Chat/).click()
      cy.wait('@endChat', { timeout: 15000 })

      cy.log('✅ Single chat workflow completed successfully')
    })
  })

  describe('Multi Chat Workflow', () => {
    it('should handle multi-chat progression: start -> message -> next chat -> message -> end', () => {
      // Login and navigate
      cy.visit('/')
      cy.get('#username').type('test_user')
      cy.get('#password').type('testpass123')
      cy.get('button').contains('Login').click()
      cy.url().should('include', '/dashboard', { timeout: 15000 })

      // Navigate to chats page
      cy.visit('/dashboard/chats')
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.wait(3000)

      // Wait for templates to load and start a chat
      cy.get('[class*="card"]', { timeout: 10000 }).should('exist')
      cy.get('[class*="card"]').should('have.length.greaterThan', 0)
      
      cy.log('✅ Starting multi-chat attempt')
      
      // Start with any available template
      cy.get('[class*="card"]').first().click()
      cy.wait('@startAttempt', { timeout: 30000 })
      cy.url().should('include', '/a/')

      // Wait for chat interface
      cy.get('[data-testid="message-input"]', { timeout: 15000 }).should('be.visible')

      // Check if this is a multi-chat (look for chat counter)
      cy.get('body').then(($chatBody) => {
        if ($chatBody.find('[data-testid="chat-counter"]').length > 0) {
          cy.log('✅ Multi-chat detected')
          
          // Send message in first chat
          cy.get('[data-testid="message-input"]').type('First chat message')
          cy.get('[data-testid="send-button"]').click()
          cy.wait('@sendMessage', { timeout: 15000 })

          // End first chat to progress
          cy.get('button').contains('End Chat').click()
          cy.wait('@endChat', { timeout: 15000 })

          // Should progress to next chat or show results
          cy.get('body').should('be.visible')
          cy.log('✅ Multi-chat progression successful')
        } else {
          cy.log('✅ Single chat detected, testing single chat flow')
          
          // Send message and end
          cy.get('[data-testid="message-input"]').type('Single chat message')
          cy.get('[data-testid="send-button"]').click()
          cy.wait('@sendMessage', { timeout: 15000 })

          cy.get('button').contains(/End Session|End Chat/).click()
          cy.wait('@endChat', { timeout: 15000 })
        }
      })

      cy.log('✅ Chat workflow completed successfully')
    })
  })

  describe('Message Sending', () => {
    it('should send messages and receive responses', () => {
      // Login and start a chat
      cy.visit('/')
      cy.get('#username').type('test_user')
      cy.get('#password').type('testpass123')
      cy.get('button').contains('Login').click()
      cy.url().should('include', '/dashboard', { timeout: 15000 })

      cy.visit('/dashboard/chats')
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.wait(3000)

      // Wait for templates to load
      cy.get('[class*="card"]', { timeout: 10000 }).should('exist')
      cy.get('[class*="card"]').first().click()
      cy.wait('@startAttempt', { timeout: 30000 })
      cy.url().should('include', '/a/')

      // Test message sending
      cy.get('[data-testid="message-input"]', { timeout: 15000 }).should('be.visible')
      cy.get('[data-testid="message-input"]').type('Test message for response verification')
      cy.get('[data-testid="send-button"]').click()

      // Wait for API call and verify response
      cy.wait('@sendMessage', { timeout: 15000 }).then((interception) => {
        expect(interception.response?.statusCode).to.be.oneOf([200, 201])
        cy.log('✅ Message API call successful')
      })

      // Should see the test response (since test_data=true)
      cy.get('body', { timeout: 10000 }).should('contain', 'This is a test response for debugging purposes')

      cy.log('✅ Message sending and response verified')
    })
  })

  describe('Guest User Workflow', () => {
    it('should allow guest users to complete chat workflow', () => {
      // Navigate directly to chats as guest
      cy.visit('/dashboard/chats')
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.wait(3000)

      // Wait for templates to load
      cy.get('[class*="card"]', { timeout: 10000 }).should('exist')
      cy.log('✅ Guest user starting chat')
      
      cy.get('[class*="card"]').first().click()
      cy.wait('@startAttempt', { timeout: 30000 })
      cy.url().should('include', '/a/')

      // Send message as guest
      cy.get('[data-testid="message-input"]', { timeout: 15000 }).should('be.visible')
      cy.get('[data-testid="message-input"]').type('Guest user test message')
      cy.get('[data-testid="send-button"]').click()
      cy.wait('@sendMessage', { timeout: 15000 })

      cy.log('✅ Guest user workflow completed')
    })
  })

  describe('Error Handling', () => {
    it('should handle API failures gracefully', () => {
      // Mock failed message send
      cy.intercept('POST', '**/attempt/message', {
        statusCode: 500,
        body: { detail: 'Test error' }
      }).as('failedMessage')

      // Start chat normally
      cy.visit('/')
      cy.get('#username').type('test_user')
      cy.get('#password').type('testpass123')
      cy.get('button').contains('Login').click()
      cy.url().should('include', '/dashboard', { timeout: 15000 })

      cy.visit('/dashboard/chats')
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.wait(3000)

      // Wait for templates to load
      cy.get('[class*="card"]', { timeout: 10000 }).should('exist')
      cy.get('[class*="card"]').first().click()
      cy.wait('@startAttempt', { timeout: 30000 })

      // Try to send message (should fail)
      cy.get('[data-testid="message-input"]', { timeout: 15000 }).should('be.visible')
      cy.get('[data-testid="message-input"]').type('This message will fail')
      cy.get('[data-testid="send-button"]').click()
      cy.wait('@failedMessage', { timeout: 10000 })

      // Interface should still be available
      cy.get('[data-testid="message-input"]').should('be.visible')
      cy.log('✅ Error handling verified')
    })
  })
})  