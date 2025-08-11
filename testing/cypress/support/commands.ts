/// <reference types="cypress" />

// Define a type for the Profile object based on your schema for type safety
type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: string;
  active: boolean;
  viewedIntro: boolean;
  viewedChat: boolean;
  defaultProfile: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
  lastActive: string;
  userId: number;
};

declare global {
  namespace Cypress {
    interface Chainable {
      // Authentication commands
      mockSession(
        user?: Partial<{
          id: string;
          name: string;
          email: string;
          role: string;
        }>
      ): Chainable<void>;
      loginAsGuest(): Chainable<void>;
      loginAsTa(): Chainable<void>;
      loginAsInstructional(): Chainable<void>;
      loginAsSuperadmin(): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
      loginAs(profile: Profile, url: string): Chainable<void>;

      // Error simulation commands
      mockSessionExpired(): Chainable<void>;
      mockNetworkError(): Chainable<void>;
      mockInvalidCredentials(): Chainable<void>;
      mockCSRFError(): Chainable<void>;

      // Profile simulation commands
      simulateProfile(profileId: string): Chainable<void>;
      returnToOriginalProfile(): Chainable<void>;
      doProfileSimulation(profileOptionTestId: string): Chainable<void>;
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
      win.localStorage.removeItem("guestMode"); // Ensure guest mode is cleared
      win.localStorage.setItem("effectiveRole", "admin");
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
  cy.url().should("include", "/practice");
  cy.window().its("localStorage.guestMode").should("eq", "true");
});

/* ───────────────────────────────────────────────────────────── */
/* loginAsTa – mock TA user session                             */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("loginAsTa", () => {
  cy.mockSession({ role: "ta" });

  cy.visit("/home", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("guestMode"); // Ensure guest mode is cleared
      win.localStorage.setItem("effectiveRole", "ta");
    },
  });

  cy.wait("@session");
  cy.contains(/home/i).should("be.visible");
});

/* ───────────────────────────────────────────────────────────── */
/* loginAsInstructional – mock instructional user session       */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("loginAsInstructional", () => {
  cy.mockSession({ role: "instructional" });

  cy.visit("/analytics/dashboard", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("guestMode"); // Ensure guest mode is cleared
      win.localStorage.setItem("effectiveRole", "instructional");
    },
  });

  cy.wait("@session");
  cy.contains(/analytics/i).should("be.visible");
});

/* ───────────────────────────────────────────────────────────── */
/* loginAsSuperadmin – mock superadmin user session             */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("loginAsSuperadmin", () => {
  cy.mockSession({ role: "superadmin" });

  cy.visit("/analytics/dashboard", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("guestMode"); // Ensure guest mode is cleared
      win.localStorage.setItem("effectiveRole", "superadmin");
    },
  });

  cy.wait("@session");
  cy.contains(/analytics/i).should("be.visible");
});

/* ───────────────────────────────────────────────────────────── */
/* mockSessionExpired – simulate expired session                */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("mockSessionExpired", () => {
  cy.intercept("GET", "/api/auth/session", {
    statusCode: 401,
    body: { error: "Session expired" },
  }).as("sessionExpired");
});

/* ───────────────────────────────────────────────────────────── */
/* mockNetworkError – simulate network failure                  */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("mockNetworkError", () => {
  cy.intercept("GET", "/api/auth/session", { forceNetworkError: true }).as(
    "networkError"
  );
});

/* ───────────────────────────────────────────────────────────── */
/* mockInvalidCredentials – simulate invalid login              */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("mockInvalidCredentials", () => {
  cy.intercept("POST", "/api/auth/signin", {
    statusCode: 401,
    body: { error: "Invalid credentials" },
  }).as("invalidCredentials");
});

/* ───────────────────────────────────────────────────────────── */
/* mockCSRFError – simulate CSRF token validation failure      */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("mockCSRFError", () => {
  cy.intercept("POST", "/api/auth/signin", {
    statusCode: 403,
    body: { error: "CSRF token validation failed" },
  }).as("csrfError");
});

/* ───────────────────────────────────────────────────────────── */
/* simulateProfile – simulate switching to different profile   */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("simulateProfile", (profileId: string) => {
  cy.window().then((win) => {
    win.localStorage.setItem("simulatedProfileId", profileId);
  });
});

/* ───────────────────────────────────────────────────────────── */
/* returnToOriginalProfile – return to original profile        */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("returnToOriginalProfile", () => {
  cy.window().then((win) => {
    win.localStorage.removeItem("simulatedProfileId");
  });
});

/* ───────────────────────────────────────────────────────────── */
/* doProfileSimulation – navigates and simulates a profile      */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("doProfileSimulation", (profileOptionTestId: string) => {
  // Navigate to profile simulation UI
  cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
  cy.url().should("include", "/profile");

  // Select a profile to simulate
  cy.get('[data-testid="profile-simulator"]').click();
  cy.get(`[data-testid="${profileOptionTestId}"]`).first().click();
});

/* ───────────────────────────────────────────────────────────── */
/* loginAs – A complete login command for any profile           */
/* ───────────────────────────────────────────────────────────── */
Cypress.Commands.add("loginAs", (profile: Profile, url: string) => {
  // 1. Mock the NextAuth session
  cy.mockSession({
    name: `${profile.firstName} ${profile.lastName}`,
    email: `${profile.alias}@example.com`,
    role: profile.role,
  });

  // 2. Mock the API call that fetches the full profile object
  cy.intercept("GET", "/api/profiles/me", {
    statusCode: 200,
    body: profile,
  }).as("getProfile");

  // 3. Mock the other initial data calls
  cy.intercept("GET", "/api/cohorts", {
    statusCode: 200,
    body: [], // Mock with an empty array
  }).as("getCohorts");

  cy.intercept("GET", "/api/profiles/simulatable", {
    statusCode: 200,
    body: [], // Mock with an empty array
  }).as("getSimulatableProfiles");

  // 4. Visit the page
  cy.visit(url);

  // 5. Wait for ALL mocks to complete before proceeding
  cy.wait([
    "@session",
    "@getProfile",
    "@getCohorts",
    "@getSimulatableProfiles",
  ]);
});

export {};
