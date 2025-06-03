describe('Chat Functionality Tests', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    
    // Mock chat-related API responses
    cy.intercept('POST', '**/chat/new', {
      statusCode: 200,
      body: {
        message: 'Chat started',
        chat_id: 'test-chat-id'
      }
    }).as('startChat')

    cy.intercept('POST', '**/chat/message', {
      statusCode: 200,
      headers: {
        'content-type': 'text/event-stream'
      },
      body: 'data: {"text": "Hello! I understand you\'re having trouble with your code. "}\n\ndata: {"text": "Can you tell me more about the specific error you\'re seeing?"}\n\ndata: {"done": true}\n\n'
    }).as('sendMessage')

    cy.intercept('POST', '**/chat/end', {
      statusCode: 200,
      body: {
        message: 'Chat ended successfully',
        rubric: {
          score: 18,
          passed: true,
          adaptability: 4,
          listening: 5,
          objectives: 4,
          time_management: 4
        }
      }
    }).as('endChat')

    cy.intercept('GET', '**/chat/**', {
      statusCode: 200,
      body: {
        id: 'test-chat-id',
        title: 'Test Chat',
        completed: false,
        profileId: '11111111-aaaa-aaaa-aaaa-111111111111'
      }
    }).as('getChat')

    cy.intercept('GET', '**/messages/**', {
      statusCode: 200,
      body: []
    }).as('getMessages')
  })

  describe('Chat Creation', () => {
    it('should start a chat with Shuffle profile', () => {
      const username = `chat_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should see Shuffle card
      cy.contains('Shuffle').should('be.visible')
      
      // Click on Shuffle card
      cy.contains('Shuffle').parents('[class*="card"]').first().click()
      
      // Should call the start chat API
      cy.wait('@startChat')
      
      // Should navigate to chat page
      cy.url().should('include', '/chat/')
    })

    it('should start a chat with specific profile (Happy)', () => {
      const username = `happy_chat_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should see Happy profile card
      cy.contains('Happy').should('be.visible')
      
      // Click on Happy card
      cy.contains('Happy').parents('[class*="card"]').first().click()
      
      cy.wait('@startChat')
      cy.url().should('include', '/chat/')
    })

    it('should start a chat with Aggressive profile', () => {
      const username = `aggressive_chat_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should see Aggressive profile card
      cy.contains('Aggressive').should('be.visible')
      
      // Click on Aggressive card
      cy.contains('Aggressive').parents('[class*="card"]').first().click()
      
      cy.wait('@startChat')
      cy.url().should('include', '/chat/')
    })

    it('should handle chat start failure gracefully', () => {
      const username = `chat_error_${Date.now()}`
      const password = 'testpass123'
      
      // Mock failed chat start
      cy.intercept('POST', '**/chat/new', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('failedChatStart')
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.contains('Shuffle').parents('[class*="card"]').first().click()
      cy.wait('@failedChatStart')
      
      // Should stay on home page and show error
      cy.url().should('include', '/home')
      cy.get('body').should('contain', 'Failed to start chat')
    })
  })

  describe('Chat Messaging', () => {
    it('should send initial message and receive response', () => {
      const username = `message_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Start a chat
      cy.contains('Shuffle').parents('[class*="card"]').first().click()
      cy.wait('@startChat')
      
      // Visit chat page directly
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMessages')
      
      // Should see initial message options
      cy.get('[data-testid="initial-message-card"]').should('have.length', 2)
      
      // Click on first initial message
      cy.get('[data-testid="initial-message-card"]').first().click()
      
      // Should call the message API
      cy.wait('@sendMessage')
      
      // Should see the message input appear
      cy.get('[data-testid="message-input"]').should('be.visible')
    })

    it('should send custom message after initial message', () => {
      const username = `custom_message_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.contains('Shuffle').parents('[class*="card"]').first().click()
      cy.wait('@startChat')
      
      // Mock chat with existing messages
      cy.intercept('GET', '**/messages/**', {
        statusCode: 200,
        body: [
          {
            id: 'msg-1',
            query: 'Hi, how are you?',
            response: 'Hello! I\'m doing well. How can I help you today?',
            createdAt: new Date().toISOString(),
            completed: true
          }
        ]
      }).as('getExistingMessages')
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getExistingMessages')
      
      // Should see message input
      cy.get('[data-testid="message-input"]').should('be.visible')
      
      // Type and send a message
      cy.get('[data-testid="message-input"]').type('I need help with my Java code')
      cy.get('[data-testid="send-button"]').click()
      
      cy.wait('@sendMessage')
    })

    it('should display chat messages correctly', () => {
      const username = `display_messages_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Mock chat with multiple messages
      cy.intercept('GET', '**/messages/**', {
        statusCode: 200,
        body: [
          {
            id: 'msg-1',
            query: 'Hi, I have a problem with my code',
            response: 'Hello! I\'d be happy to help you with your code. What specific issue are you encountering?',
            createdAt: new Date().toISOString(),
            completed: true
          },
          {
            id: 'msg-2',
            query: 'I\'m getting a NullPointerException',
            response: 'A NullPointerException occurs when you try to use a reference that points to no location in memory. Can you show me the specific line where this error occurs?',
            createdAt: new Date().toISOString(),
            completed: true
          }
        ]
      }).as('getMultipleMessages')
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMultipleMessages')
      
      // Should see both messages
      cy.get('body').should('contain', 'Hi, I have a problem with my code')
      cy.get('body').should('contain', 'Hello! I\'d be happy to help you')
      cy.get('body').should('contain', 'I\'m getting a NullPointerException')
      cy.get('body').should('contain', 'A NullPointerException occurs when')
    })
  })

  describe('Chat Completion', () => {
    it('should end chat successfully', () => {
      const username = `end_chat_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.contains('Shuffle').parents('[class*="card"]').first().click()
      cy.wait('@startChat')
      
      // Mock chat with existing messages
      cy.intercept('GET', '**/messages/**', {
        statusCode: 200,
        body: [
          {
            id: 'msg-1',
            query: 'Hi, how are you?',
            response: 'Hello! I\'m doing well. How can I help you today?',
            createdAt: new Date().toISOString(),
            completed: true
          }
        ]
      }).as('getMessagesForEnd')
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMessagesForEnd')
      
      // End the chat
      cy.get('[data-testid="end-chat-button"]').click()
      cy.wait('@endChat')
      
      // Should show completion message or navigate away
      cy.get('body').should('contain', 'Chat ended')
    })

    it('should show rubric after chat completion', () => {
      const username = `rubric_user_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.contains('Happy').parents('[class*="card"]').first().click()
      cy.wait('@startChat')
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMessages')
      
      // End the chat
      cy.get('[data-testid="end-chat-button"]').click()
      cy.wait('@endChat')
      
      // Should show rubric information
      cy.get('body').should('contain', 'Score: 18')
      cy.get('body').should('contain', 'Passed: true')
    })
  })

  describe('Guest Chat Access', () => {
    it('should allow guest users to start chats', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      // Click on a profile card
      cy.contains('Happy').parents('[class*="card"]').first().click()
      
      cy.wait('@startChat')
      cy.url().should('include', '/chat/')
    })

    it('should show limited functionality for guest chats', () => {
      cy.visit('/')
      cy.get('button').contains('Continue as Guest').click()
      
      cy.url().should('include', '/home', { timeout: 10000 })
      
      cy.contains('Confused').parents('[class*="card"]').first().click()
      cy.wait('@startChat')
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMessages')
      
      // Should see basic chat functionality
      cy.get('[data-testid="initial-message-card"]').should('exist')
    })
  })

  describe('Chat Error Handling', () => {
    it('should handle message sending failure', () => {
      const username = `message_error_${Date.now()}`
      const password = 'testpass123'
      
      // Mock failed message sending
      cy.intercept('POST', '**/chat/message', {
        statusCode: 500,
        body: { error: 'Failed to send message' }
      }).as('failedMessage')
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.contains('Shuffle').parents('[class*="card"]').first().click()
      cy.wait('@startChat')
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMessages')
      
      // Try to send initial message
      cy.get('[data-testid="initial-message-card"]').first().click()
      cy.wait('@failedMessage')
      
      // Should show error message
      cy.get('body').should('contain', 'Failed to send message')
    })

    it('should handle chat end failure', () => {
      const username = `end_error_${Date.now()}`
      const password = 'testpass123'
      
      // Mock failed chat end
      cy.intercept('POST', '**/chat/end', {
        statusCode: 500,
        body: { error: 'Failed to end chat' }
      }).as('failedEndChat')
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.visit('/chat/test-chat-id')
      cy.wait('@getChat')
      cy.wait('@getMessages')
      
      // Try to end chat
      cy.get('[data-testid="end-chat-button"]').click()
      cy.wait('@failedEndChat')
      
      // Should show error message
      cy.get('body').should('contain', 'Failed to end chat')
    })
  })
}) 