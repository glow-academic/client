describe('Quiz Functionality Tests', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    
    // Mock quiz-related API responses
    cy.intercept('POST', '**/quiz/start', {
      statusCode: 200,
      body: {
        message: 'Quiz started',
        quiz_id: 'test-quiz-id',
        chat_ids: ['chat-1', 'chat-2'],
        total_chats: 2
      }
    }).as('startQuiz')

    cy.intercept('GET', '**/quiz/**', {
      statusCode: 200,
      body: {
        id: 'test-quiz-id',
        title: 'CS 180 Practice Quiz',
        timeLimit: 15,
        classId: '44444444-1111-1111-1111-111111111111'
      }
    }).as('getQuiz')

    cy.intercept('GET', '**/quiz-chats/**', {
      statusCode: 200,
      body: [
        {
          id: 'chat-1',
          title: 'NullPointer Exception',
          completed: false,
          profileId: '11111111-aaaa-aaaa-aaaa-111111111111'
        },
        {
          id: 'chat-2', 
          title: 'File I/O Issues',
          completed: false,
          profileId: '22222222-bbbb-bbbb-bbbb-222222222222'
        }
      ]
    }).as('getQuizChats')
  })

  describe('Quiz Access and Visibility', () => {
    it('should show quiz for enrolled students', () => {
      const username = `quiz_user_${Date.now()}`
      const password = 'testpass123'
      
      // Login and assign user to CS 180 class
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.task('assignUserToClass', { 
        username, 
        classId: '44444444-1111-1111-1111-111111111111' 
      })
      
      // Refresh to see quiz
      cy.reload()
      cy.wait(2000)
      
      // Should see the CS 180 Practice Quiz
      cy.get('body').should('contain', 'CS 180 Practice Quiz')
      cy.get('[data-testid="quiz-card"]').should('be.visible')
    })

    it('should not show quiz for non-enrolled users', () => {
      const username = `non_enrolled_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Should not see quiz cards
      cy.get('[data-testid="quiz-card"]').should('not.exist')
    })
  })

  describe('Quiz Starting Process', () => {
    it('should successfully start a quiz', () => {
      const username = `quiz_starter_${Date.now()}`
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
      
      // Click on quiz card
      cy.get('[data-testid="quiz-card"]').should('be.visible').click()
      
      // Should call the start quiz API
      cy.wait('@startQuiz')
      
      // Should navigate to quiz page
      cy.url().should('include', '/quiz/')
    })

    it('should handle quiz start failure gracefully', () => {
      const username = `error_user_${Date.now()}`
      const password = 'testpass123'
      
      // Mock failed quiz start
      cy.intercept('POST', '**/quiz/start', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('failedQuizStart')
      
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
      
      cy.get('[data-testid="quiz-card"]').click()
      cy.wait('@failedQuizStart')
      
      // Should stay on home page and show error
      cy.url().should('include', '/home')
      cy.get('body').should('contain', 'Failed to start quiz')
    })
  })

  describe('Quiz Page Elements', () => {
    it('should display quiz page elements correctly', () => {
      const username = `quiz_page_${Date.now()}`
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
      
      // Start quiz
      cy.get('[data-testid="quiz-card"]').click()
      cy.wait('@startQuiz')
      
      // Visit quiz page directly to test elements
      cy.visit('/quiz/test-quiz-id')
      cy.wait('@getQuiz')
      cy.wait('@getQuizChats')
      
      // Should see quiz elements
      cy.get('[data-testid="timer"]').should('be.visible')
      cy.get('[data-testid="chat-counter"]').should('contain', 'Chat 1 of 2')
      cy.get('[data-testid="sidebar-trigger"]').should('be.visible')
    })

    it('should show quiz title and time limit', () => {
      const username = `quiz_info_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      // Visit quiz page directly
      cy.visit('/quiz/test-quiz-id')
      cy.wait('@getQuiz')
      
      // Should see quiz information
      cy.get('body').should('contain', 'CS 180 Practice Quiz')
      cy.get('body').should('contain', '15') // time limit
    })
  })

  describe('Quiz Navigation', () => {
    it('should navigate between quiz chats', () => {
      const username = `quiz_nav_${Date.now()}`
      const password = 'testpass123'
      
      cy.visit('/')
      cy.get('#username').type(username)
      cy.get('#password').type(password)
      cy.get('button').contains('Login').click()
      
      cy.url().should('include', '/home', { timeout: 15000 })
      
      cy.visit('/quiz/test-quiz-id')
      cy.wait('@getQuiz')
      cy.wait('@getQuizChats')
      
      // Should see chat list in sidebar
      cy.get('[data-testid="sidebar-trigger"]').click()
      cy.get('body').should('contain', 'NullPointer Exception')
      cy.get('body').should('contain', 'File I/O Issues')
    })
  })
}) 