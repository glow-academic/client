/// <reference types="cypress" />

describe("Auth - admin & guest flows", () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it("shows Microsoft + Guest buttons", () => {
    cy.visit("/");
    cy.contains("Glow");
    cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
    cy.get('[data-testid="guest-login-button"]').should("be.visible");
  });

  it("logs in as guest", () => {
    cy.loginAsGuest();
    cy.contains(/home/i).should("be.visible");
  });

  it("logs in as admin (mocked)", () => {
    cy.loginAsAdmin();
    cy.url().should("include", "/analytics");
    cy.window().its("localStorage.effectiveRole").should("eq", "admin");
  });
});
