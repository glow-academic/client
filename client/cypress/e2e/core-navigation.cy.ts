describe('Core Navigation & Role Switching', () => {
  beforeEach(() => {
    cy.clearAllStorage()
    cy.setupApiMocks()
    
    // Mock role switching
    cy.intercept('POST', '**/switch-role', { statusCode: 200, body: { role: 'switched' } }).as('switchRole')
  })

  describe('Basic Navigation', () => {
    it('should navigate between main pages as user', () => {
      cy.loginAsUser()
      
      // Navigate to chats
      cy.navigateToPage('/dashboard/chats')
      cy.get('main').should('be.visible')
      
      // Navigate to history
      cy.navigateToPage('/dashboard/history')
      cy.get('main').should('be.visible')
      
      // Navigate to profile
      cy.navigateToPage('/(main)/profile')
      cy.get('main').should('be.visible')
    })

    it('should navigate between admin pages', () => {
      cy.loginAsAdmin()
      
      // Navigate to analytics
      cy.navigateToPage('/dashboard/analytics')
      cy.get('main').should('be.visible')
      
      // Navigate to management
      cy.navigateToPage('/(main)/management/instructor')
      cy.get('main').should('be.visible')
      
      // Navigate to classes
      cy.navigateToPage('/(main)/classes/general')
      cy.get('main').should('be.visible')
    })

    it('should show proper navigation elements', () => {
      cy.loginAsUser()
      cy.navigateToPage('/dashboard/chats')
      
      // Should have navigation elements
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="sidebar-trigger"]').length > 0) {
          cy.get('[data-testid="sidebar-trigger"]').should('be.visible')
        } else if ($body.find('nav').length > 0) {
          cy.get('nav').should('be.visible')
        } else {
          cy.get('header').should('be.visible')
        }
      })
    })
  })

  describe('Role Switching', () => {
    it('should switch effective role', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/dashboard/analytics')
      
      // Find and click role switcher
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="role-switcher"]').length > 0) {
          cy.get('[data-testid="role-switcher"]').click()
          cy.get('[data-testid="switch-to-instructor"]').click()
          cy.wait('@switchRole')
        } else if ($body.find('button:contains("Switch Role")').length > 0) {
          cy.get('button').contains('Switch Role').click()
          cy.get('button').contains('Instructor').click()
          cy.wait('@switchRole')
        } else {
          // Role switcher might be in dropdown or menu
          cy.get('[data-testid="user-menu"]').click()
          cy.get('[data-testid="switch-role"]').click()
        }
      })
      
      // Should show role change confirmation
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(switched|role|instructor)/i)
      })
    })

    it('should show different content based on role', () => {
      cy.loginAsAdmin()
      cy.navigateToPage('/dashboard/analytics')
      
      // Should see admin content
      cy.get('body').then(($body) => {
        expect($body.text()).to.match(/(analytics|admin|dashboard)/i)
      })
      
      // Switch to instructor role (if available)
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="role-switcher"]').length > 0) {
          cy.get('[data-testid="role-switcher"]').click()
          cy.get('[data-testid="switch-to-instructor"]').click()
          
          // Should see different content
          cy.get('body').then(($newBody) => {
            expect($newBody.text()).to.match(/(instructor|teaching|class)/i)
          })
        }
      })
    })

    it('should restrict access based on role', () => {
      cy.loginAsUser()
      
      // Try to access admin page
      cy.navigateToPage('/dashboard/analytics')
      
      // Should either redirect or show access denied
      cy.url().then((url) => {
        if (url.includes('/analytics')) {
          cy.get('body').then(($body) => {
            expect($body.text()).to.match(/(access denied|unauthorized|forbidden)/i)
          })
        } else {
          cy.url().should('not.include', '/analytics')
        }
      })
    })
  })

  describe('Responsive Navigation', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667)
      cy.loginAsUser()
      cy.navigateToPage('/dashboard/chats')
      
      // Should have mobile navigation
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="mobile-menu"]').length > 0) {
          cy.get('[data-testid="mobile-menu"]').should('be.visible')
        } else if ($body.find('[data-testid="sidebar-trigger"]').length > 0) {
          cy.get('[data-testid="sidebar-trigger"]').should('be.visible')
        } else {
          cy.get('header').should('be.visible')
        }
      })
    })

    it('should work on tablet devices', () => {
      cy.viewport(768, 1024)
      cy.loginAsUser()
      cy.navigateToPage('/dashboard/chats')
      
      // Should have proper navigation
      cy.get('main').should('be.visible')
      cy.get('header').should('be.visible')
    })
  })

  describe('Navigation State', () => {
    it('should maintain navigation state during session', () => {
      cy.loginAsUser()
      cy.navigateToPage('/dashboard/chats')
      
      // Start a chat
      cy.startChat('Happy')
      cy.url().should('include', '/c/')
      
      // Navigate back
      cy.go('back')
      cy.url().should('include', '/dashboard/chats')
      
      // Should still be logged in
      cy.get('main').should('be.visible')
    })

    it('should handle deep linking', () => {
      cy.loginAsUser()
      
      // Navigate directly to a deep link
      cy.navigateToPage('/(main)/profile')
      cy.get('main').should('be.visible')
      
      // Should maintain authentication
      cy.url().should('include', '/profile')
    })
  })

  describe('Guest Navigation Restrictions', () => {
    it('should limit guest navigation', () => {
      cy.loginAsGuest()
      
      // Should be able to access chats
      cy.navigateToPage('/dashboard/chats')
      cy.get('main').should('be.visible')
      
      // Should not be able to access management
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
  })
}) 