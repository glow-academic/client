/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      mockSession(
        user?: Partial<{
          id: string;
          name: string;
          email: string;
          role: string;
        }>
      ): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
      loginAsGuest(): Chainable<void>;
    }
  }
}

/* ───────────────────────────────────────────────────────────── */
/* mockSession – stub next-auth                                 */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("mockSession", (user = {}) => {
  const defaults = {
    id: "0000-0000-CYPRESS",
    name: "Cypress Admin",
    email: "tester@example.com",
    role: "admin",
  };

  cy.intercept("GET", "/api/auth/session", {
    statusCode: 200,
    headers: { "cache-control": "no-store" },
    body: {
      user: { ...defaults, ...user },
      expires: "2099-12-31T23:59:59.999Z",
    },
  }).as("session");
});

/* ───────────────────────────────────────────────────────────── */
/* loginAsAdmin – mock + optional debug flag                    */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("loginAsAdmin", () => {
  cy.mockSession({ role: "admin" });

  cy.visit("/analytics", {
    onBeforeLoad(win) {
      win.localStorage.setItem("effectiveRole", "admin"); // 👈 debug flag
    },
  });

  cy.wait("@session");
  cy.contains(/analytics/i).should("be.visible");
});

/* ───────────────────────────────────────────────────────────── */
/* loginAsGuest – real UI path                                  */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("loginAsGuest", () => {
  cy.visit("/");
  cy.get('[data-testid="guest-login-button"]').click();
  cy.url().should("include", "/home");
  cy.window().its("localStorage.guestMode").should("eq", "true");
});

export {};
