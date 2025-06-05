describe('Core Management Operations', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    cy.setupApiMocks()
    
    // Mock management API endpoints
    cy.intercept('POST', '**/profiles', { statusCode: 200, body: { id: 'new-profile-id' } }).as('createProfile')
    cy.intercept('PUT', '**/profiles/**', { statusCode: 200, body: { message: 'Profile updated' } }).as('updateProfile')
    cy.intercept('DELETE', '**/profiles/**', { statusCode: 200, body: { message: 'Profile deleted' } }).as('deleteProfile')
    
    cy.intercept('POST', '**/scenarios', { statusCode: 200, body: { id: 'new-scenario-id' } }).as('createScenario')
    cy.intercept('PUT', '**/scenarios/**', { statusCode: 200, body: { message: 'Scenario updated' } }).as('updateScenario')
    cy.intercept('DELETE', '**/scenarios/**', { statusCode: 200, body: { message: 'Scenario deleted' } }).as('deleteScenario')
    
    cy.intercept('POST', '**/templates', { statusCode: 200, body: { id: 'new-template-id' } }).as('createTemplate')
    cy.intercept('PUT', '**/templates/**', { statusCode: 200, body: { message: 'Template updated' } }).as('updateTemplate')
    cy.intercept('DELETE', '**/templates/**', { statusCode: 200, body: { message: 'Template deleted' } }).as('deleteTemplate')
    
    cy.intercept('POST', '**/users', { statusCode: 200, body: { id: 'new-user-id' } }).as('createUser')
    cy.intercept('POST', '**/classes', { statusCode: 200, body: { id: 'new-class-id' } }).as('createClass')
    
    cy.intercept('POST', '**/upload', { statusCode: 200, body: { url: 'uploaded-file-url' } }).as('uploadDocument')
    
    // Mock server actions for data fetching
    cy.intercept('POST', '/_next/static/chunks/app/**', { statusCode: 200 }).as('serverAction')
  })

  describe('Profile Management', () => {
    it('should create a new profile', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/profiles/new')
      
      // Fill profile form
      cy.get('[data-testid="profile-name"]').type('Test Profile')
      cy.get('[data-testid="profile-description"]').type('Test Description')
      cy.get('[data-testid="save-profile"]').click()
      
      cy.wait('@createProfile')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(created|success)/i)
      })
    })

    it('should update an existing profile', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/profiles/p/test-profile-id')
      
      // Update profile
      cy.get('[data-testid="edit-profile"]').click()
      cy.get('[data-testid="profile-name"]').clear().type('Updated Profile')
      cy.get('[data-testid="save-profile"]').click()
      
      cy.wait('@updateProfile')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(updated|success)/i)
      })
    })

    it('should delete a profile', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/profiles')
      
      // Delete profile
      cy.get('[data-testid="delete-profile"]').first().click()
      cy.get('[data-testid="confirm-delete"]').click()
      
      cy.wait('@deleteProfile')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(deleted|removed)/i)
      })
    })
  })

  describe('Scenario Management', () => {
    it('should create a new scenario', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/scenarios/new')
      
      // Fill scenario form
      cy.get('[data-testid="scenario-title"]').type('Test Scenario')
      cy.get('[data-testid="scenario-description"]').type('Test scenario description')
      cy.get('[data-testid="save-scenario"]').click()
      
      cy.wait('@createScenario')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(created|success)/i)
      })
    })

    it('should update a scenario', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/scenarios/s/test-scenario-id')
      
      // Update scenario
      cy.get('[data-testid="edit-scenario"]').click()
      cy.get('[data-testid="scenario-title"]').clear().type('Updated Scenario')
      cy.get('[data-testid="save-scenario"]').click()
      
      cy.wait('@updateScenario')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(updated|success)/i)
      })
    })

    it('should delete a scenario', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/scenarios')
      
      // Delete scenario
      cy.get('[data-testid="delete-scenario"]').first().click()
      cy.get('[data-testid="confirm-delete"]').click()
      
      cy.wait('@deleteScenario')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(deleted|removed)/i)
      })
    })
  })

  describe('Template Management', () => {
    it('should create a new template', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/templates/new')
      
      // Fill template form
      cy.get('[data-testid="template-name"]').type('Test Template')
      cy.get('[data-testid="template-content"]').type('Template content here')
      cy.get('[data-testid="save-template"]').click()
      
      cy.wait('@createTemplate')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(created|success)/i)
      })
    })

    it('should update a template', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/templates/t/test-template-id')
      
      // Update template
      cy.get('[data-testid="edit-template"]').click()
      cy.get('[data-testid="template-name"]').clear().type('Updated Template')
      cy.get('[data-testid="save-template"]').click()
      
      cy.wait('@updateTemplate')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(updated|success)/i)
      })
    })

    it('should delete a template', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/templates')
      
      // Delete template
      cy.get('[data-testid="delete-template"]').first().click()
      cy.get('[data-testid="confirm-delete"]').click()
      
      cy.wait('@deleteTemplate')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(deleted|removed)/i)
      })
    })
  })

  describe('User Management', () => {
    it('should add new instructional specialist', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/management/instructional/new')
      
      // Fill user form
      cy.get('[data-testid="user-name"]').type('Test Specialist')
      cy.get('[data-testid="user-email"]').type('specialist@test.com')
      cy.get('[data-testid="save-user"]').click()
      
      cy.wait('@createUser')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(added|created)/i)
      })
    })

    it('should add new instructor', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/management/instructor/new')
      
      // Fill instructor form
      cy.get('[data-testid="user-name"]').type('Test Instructor')
      cy.get('[data-testid="user-email"]').type('instructor@test.com')
      cy.get('[data-testid="save-user"]').click()
      
      cy.wait('@createUser')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(added|created)/i)
      })
    })

    it('should add new TA', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/management/ta/new')
      
      // Fill TA form
      cy.get('[data-testid="user-name"]').type('Test TA')
      cy.get('[data-testid="user-email"]').type('ta@test.com')
      cy.get('[data-testid="save-user"]').click()
      
      cy.wait('@createUser')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(added|created)/i)
      })
    })
  })

  describe('Class Management', () => {
    it('should create a new class', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/classes/new')
      
      // Fill class form
      cy.get('[data-testid="class-name"]').type('Test Class')
      cy.get('[data-testid="class-description"]').type('Test class description')
      cy.get('[data-testid="save-class"]').click()
      
      cy.wait('@createClass')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(created|success)/i)
      })
    })
  })

  describe('Document Upload', () => {
    it('should upload a document', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/templates/new')
      
      // Upload document
      cy.get('[data-testid="file-upload"]').selectFile('cypress/fixtures/test-document.pdf', { force: true })
      
      cy.wait('@uploadDocument')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(uploaded|success)/i)
      })
    })
  })
}) 