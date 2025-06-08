describe('Core Management Operations', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    cy.setupApiMocks()
    
    // Mock management API endpoints
    cy.intercept('POST', '**/agents', { statusCode: 200, body: { id: 'new-agent-id' } }).as('createAgent')
    cy.intercept('PUT', '**/agents/**', { statusCode: 200, body: { message: 'Agent updated' } }).as('updateAgent')
    cy.intercept('DELETE', '**/agents/**', { statusCode: 200, body: { message: 'Agent deleted' } }).as('deleteAgent')
    
    cy.intercept('POST', '**/scenarios', { statusCode: 200, body: { id: 'new-scenario-id' } }).as('createScenario')
    cy.intercept('PUT', '**/scenarios/**', { statusCode: 200, body: { message: 'Scenario updated' } }).as('updateScenario')
    cy.intercept('DELETE', '**/scenarios/**', { statusCode: 200, body: { message: 'Scenario deleted' } }).as('deleteScenario')
    
    cy.intercept('POST', '**/simulations', { statusCode: 200, body: { id: 'new-simulation-id' } }).as('createSimulation')
    cy.intercept('PUT', '**/simulations/**', { statusCode: 200, body: { message: 'Simulation updated' } }).as('updateSimulation')
    cy.intercept('DELETE', '**/simulations/**', { statusCode: 200, body: { message: 'Simulation deleted' } }).as('deleteSimulation')
    
    cy.intercept('POST', '**/users', { statusCode: 200, body: { id: 'new-user-id' } }).as('createUser')
    cy.intercept('POST', '**/classes', { statusCode: 200, body: { id: 'new-class-id' } }).as('createClass')
    
    cy.intercept('POST', '**/upload', { statusCode: 200, body: { url: 'uploaded-file-url' } }).as('uploadDocument')
    
    // Mock server actions for data fetching
    cy.intercept('POST', '/_next/static/chunks/app/**', { statusCode: 200 }).as('serverAction')
  })

  describe('Agent Management', () => {
    it('should create a new agent', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/agents/new')
      
      // Fill agent form
      cy.get('[data-testid="agent-name"]').type('Test Agent')
      cy.get('[data-testid="agent-description"]').type('Test Description')
      cy.get('[data-testid="save-agent"]').click()
      
      cy.wait('@createAgent')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(created|success)/i)
      })
    })

    it('should update an existing agent', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/agents/a/test-agent-id')
      
      // Update agent
      cy.get('[data-testid="edit-agent"]').click()
      cy.get('[data-testid="agent-name"]').clear().type('Updated Agent')
      cy.get('[data-testid="save-agent"]').click()
      
      cy.wait('@updateAgent')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(updated|success)/i)
      })
    })

    it('should delete an agent', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/chat/agents')
      
      // Delete agent
      cy.get('[data-testid="delete-agent"]').first().click()
      cy.get('[data-testid="confirm-delete"]').click()
      
      cy.wait('@deleteAgent')
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

  describe('Simulation Management', () => {
    it('should create a new simulation', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/simulations/new')
      
      // Fill simulation form
      cy.get('[data-testid="simulation-name"]').type('Test Simulation')
      cy.get('[data-testid="simulation-content"]').type('Simulation content here')
      cy.get('[data-testid="save-simulation"]').click()
      
      cy.wait('@createSimulation')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(created|success)/i)
      })
    })

    it('should update a simulation', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/simulations/s/test-simulation-id')
      
      // Update simulation
      cy.get('[data-testid="edit-simulation"]').click()
      cy.get('[data-testid="simulation-name"]').clear().type('Updated Simulation')
      cy.get('[data-testid="save-simulation"]').click()
      
      cy.wait('@updateSimulation')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(updated|success)/i)
      })
    })

    it('should delete a simulation', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/simulations')
      
      // Delete simulation
      cy.get('[data-testid="delete-simulation"]').first().click()
      cy.get('[data-testid="confirm-delete"]').click()
      
      cy.wait('@deleteSimulation')
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
      cy.navigateToPage('/simulations/new')
      
      // Upload document
      cy.get('[data-testid="file-upload"]').selectFile('cypress/fixtures/test-document.pdf', { force: true })
      
      cy.wait('@uploadDocument')
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(uploaded|success)/i)
      })
    })
  })
}) 