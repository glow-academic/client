/// <reference types="cypress" />

describe('Cohorts End-to-End Tests', () => {
    beforeEach(() => {
      cy.clearAllStorage();
      cy.loginAsGuest();
    });
  
    describe('CRUD Operations', () => {
      it.skip('should create cohorts records');      // TODO
      it.skip('should read cohorts records');        // TODO
    });
  
    describe('Error Handling', () => {
      it.skip('should handle validation errors when creating cohorts'); // TODO
      it.skip('should handle constraint violations gracefully');     // TODO
    });
  });
  