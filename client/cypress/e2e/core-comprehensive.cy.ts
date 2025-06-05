describe('GLOW Core Functionality - Comprehensive Test', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    cy.setupApiMocks()
    
    // Mock all management endpoints
    cy.intercept('POST', '**/profiles', { statusCode: 200, body: { id: 'new-profile-id' } }).as('createProfile')
    cy.intercept('POST', '**/scenarios', { statusCode: 200, body: { id: 'new-scenario-id' } }).as('createScenario')
    cy.intercept('POST', '**/templates', { statusCode: 200, body: { id: 'new-template-id' } }).as('createTemplate')
    cy.intercept('POST', '**/users', { statusCode: 200, body: { id: 'new-user-id' } }).as('createUser')
    cy.intercept('POST', '**/classes', { statusCode: 200, body: { id: 'new-class-id' } }).as('createClass')
    cy.intercept('POST', '**/upload', { statusCode: 200, body: { url: 'uploaded-file-url' } }).as('uploadDocument')
  })

  it('should complete full admin workflow', () => {
    // 1. Login as admin
    cy.loginAsAdmin()
    cy.url().should('include', '/dashboard')
    
    // 2. Navigate to analytics
    cy.navigateToPage('/dashboard/analytics')
    cy.get('main').should('be.visible')
    
    // 3. Create a new profile
    cy.navigateToPage('/(main)/chat/profiles/new')
    cy.get('[data-testid="profile-name"]').type('Test Profile')
    cy.get('[data-testid="profile-description"]').type('Test Description')
    cy.get('[data-testid="save-profile"]').click()
    cy.wait('@createProfile')
    
    // 4. Create a new scenario
    cy.navigateToPage('/(main)/chat/scenarios/new')
    cy.get('[data-testid="scenario-title"]').type('Test Scenario')
    cy.get('[data-testid="scenario-description"]').type('Test scenario description')
    cy.get('[data-testid="save-scenario"]').click()
    cy.wait('@createScenario')
    
    // 5. Create a new template
    cy.navigateToPage('/(main)/chat/templates/new')
    cy.get('[data-testid="template-name"]').type('Test Template')
    cy.get('[data-testid="template-content"]').type('Template content here')
    cy.get('[data-testid="save-template"]').click()
    cy.wait('@createTemplate')
    
    // 6. Add new instructor
    cy.navigateToPage('/(main)/management/instructor/new')
    cy.get('[data-testid="user-name"]').type('Test Instructor')
    cy.get('[data-testid="user-email"]').type('instructor@test.com')
    cy.get('[data-testid="save-user"]').click()
    cy.wait('@createUser')
    
    // 7. Create new class
    cy.navigateToPage('/(main)/classes/new')
    cy.get('[data-testid="class-name"]').type('Test Class')
    cy.get('[data-testid="class-description"]').type('Test class description')
    cy.get('[data-testid="save-class"]').click()
    cy.wait('@createClass')
    
    // 8. Test document upload
    cy.navigateToPage('/(main)/chat/templates/new')
    cy.get('[data-testid="file-upload"]').selectFile('cypress/fixtures/test-document.pdf', { force: true })
    cy.wait('@uploadDocument')
    
    // 9. Logout
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="logout-button"]').length > 0) {
        cy.get('[data-testid="logout-button"]').click()
      } else if ($body.find('button:contains("Logout")').length > 0) {
        cy.get('button').contains('Logout').click()
      } else {
        cy.get('button').contains('Logout').click()
      }
    })
    
    cy.url().should('not.include', '/dashboard')
  })

  it('should complete full user workflow', () => {
    // 1. Login as regular user
    cy.loginAsUser()
    cy.url().should('include', '/dashboard')
    
    // 2. Navigate to chats
    cy.navigateToPage('/dashboard/chats')
    cy.get('main').should('be.visible')
    
    // 3. Start a chat
    cy.startChat('Happy')
    cy.url().should('include', '/c/')
    
    // 4. Send initial message
    cy.get('[data-testid="initial-message-card"]').first().click()
    cy.wait('@sendMessage')
    
    // 5. Send custom message
    cy.sendMessage('Hello, this is a test message from the comprehensive test')
    cy.get('[data-testid="chat-messages"]').should('contain', 'Hello, this is a test message')
    
    // 6. End chat session
    cy.get('[data-testid="end-chat-button"]').click()
    cy.wait('@endChat')
    
    // 7. Navigate to history
    cy.navigateToPage('/dashboard/history')
    cy.get('main').should('be.visible')
    
    // 8. Navigate to profile
    cy.navigateToPage('/(main)/profile')
    cy.get('main').should('be.visible')
    
    // 9. Logout
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="logout-button"]').length > 0) {
        cy.get('[data-testid="logout-button"]').click()
      } else if ($body.find('button:contains("Logout")').length > 0) {
        cy.get('button').contains('Logout').click()
      } else {
        cy.get('button').contains('Logout').click()
      }
    })
    
    cy.url().should('not.include', '/dashboard')
  })

  it('should complete guest workflow', () => {
    // 1. Continue as guest
    cy.loginAsGuest()
    cy.url().should('include', '/dashboard')
    cy.window().its('localStorage').invoke('getItem', 'guestMode').should('equal', 'true')
    
    // 2. Navigate to chats
    cy.navigateToPage('/dashboard/chats')
    cy.get('main').should('be.visible')
    
    // 3. Start a chat as guest
    cy.startChat('Shuffle')
    cy.url().should('include', '/c/')
    
    // 4. Send initial message
    cy.get('[data-testid="initial-message-card"]').first().click()
    cy.wait('@sendMessage')
    
    // 5. Send custom message
    cy.sendMessage('Guest test message')
    cy.get('[data-testid="chat-messages"]').should('contain', 'Guest test message')
    
    // 6. Try to access restricted area (should be denied)
    cy.navigateToPage('/(main)/management/instructor')
    cy.url().then((url) => {
      if (url.includes('/management')) {
        cy.get('body').then(($body) => {
          expect($body.text()).to.match(/(access denied|unauthorized|guest)/i)
        })
      } else {
        cy.url().should('not.include', '/management')
      }
    })
  })

  it('should handle error scenarios gracefully', () => {
    // Test network errors
    cy.intercept('POST', '**/chat/new', { forceNetworkError: true }).as('networkError')
    
    cy.loginAsUser()
    cy.navigateToPage('/dashboard/chats')
    
    // Try to start chat with network error
    cy.contains('Happy').parents('[class*="card"]').first().click()
    cy.wait('@networkError')
    
    // Should show error message
    cy.get('body').then(($body) => {
      expect($body.text()).to.match(/(failed|error|network)/i)
    })
    
    // Test invalid credentials
    cy.visit('/')
    cy.get('#username').type('invalid_user')
    cy.get('#password').type('wrong_password')
    cy.get('button').contains('Login').click()
    
    // Should show error message
    cy.get('body').then(($body) => {
      expect($body.text().toLowerCase()).to.match(/(error|invalid|failed)/)
    })
  })

  it('should work across different screen sizes', () => {
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1280, height: 720 }
    ]

    viewports.forEach(viewport => {
      cy.viewport(viewport.width, viewport.height)
      
      // Test login page
      cy.visit('/')
      cy.get('#username').should('be.visible')
      cy.get('#password').should('be.visible')
      
      // Test main page
      cy.loginAsUser()
      cy.navigateToPage('/dashboard/chats')
      cy.get('main').should('be.visible')
      
      // Test chat functionality
      cy.startChat('Happy')
      cy.url().should('include', '/c/')
      
      // Clear for next iteration
      cy.clearAllStorage()
    })
  })
}) 