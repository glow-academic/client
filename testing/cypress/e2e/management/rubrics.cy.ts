/// <reference types="cypress" />

describe('Rubrics End-to-End Tests', () => {
  beforeEach(() => {
    cy.clearAllStorage();
    cy.loginAsGuest();
  });

  describe('CRUD Operations', () => {
    it.skip('should create rubrics records');      // TODO
    it.skip('should read rubrics records');        // TODO
  });

  describe('Error Handling', () => {
    it.skip('should handle validation errors when creating rubrics'); // TODO
    it.skip('should handle constraint violations gracefully');     // TODO
  });
});
