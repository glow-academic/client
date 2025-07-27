/// <reference types="cypress" />

describe('Models End-to-End Tests', () => {
    beforeEach(() => {
      cy.clearAllStorage();
      cy.loginAsGuest();
    });
  
    describe('CRUD Operations', () => {
      it.skip('should create models records');      // TODO
      it.skip('should read models records');        // TODO
    });
  
    describe('Error Handling', () => {
      it.skip('should handle validation errors when creating models'); // TODO
      it.skip('should handle constraint violations gracefully');     // TODO
    });
  });
  