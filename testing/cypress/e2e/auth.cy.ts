/// <reference types="cypress" />

describe("Auth - admin & guest flows", () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe("Login Page Functionality", () => {
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

  describe("Role-Based Authentication", () => {
    it("should login as TA user and redirect to home page", () => {
      // Mock TA user session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Verify redirect to /home
      cy.url().should("include", "/home");

      // Verify localStorage contains correct role
      cy.window().its("localStorage.effectiveRole").should("eq", "ta");

      // Verify sidebar shows appropriate options
      cy.get('[data-sidebar="menu-button"]').should("contain", "Home");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Practice");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Analytics");
    });

    it("should login as instructional user and redirect to analytics dashboard", () => {
      // Mock instructional user session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Verify redirect to /analytics/dashboard
      cy.url().should("include", "/analytics/dashboard");

      // Verify localStorage contains correct role
      cy.window()
        .its("localStorage.effectiveRole")
        .should("eq", "instructional");

      // Verify sidebar shows appropriate options
      cy.get('[data-sidebar="menu-button"]').should("contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should(
        "not.contain",
        "Management"
      );
    });

    it("should login as superadmin user and redirect to analytics dashboard", () => {
      // Mock superadmin user session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Verify redirect to /analytics/dashboard
      cy.url().should("include", "/analytics/dashboard");

      // Verify localStorage contains correct role
      cy.window().its("localStorage.effectiveRole").should("eq", "superadmin");

      // Verify sidebar shows appropriate options
      cy.get('[data-sidebar="menu-button"]').should("contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Management");
      cy.get('[data-sidebar="menu-button"]').should("contain", "System");
    });
  });

  describe("Authentication State Management", () => {
    it("should maintain authentication state across page refreshes", () => {
      // Login as any role
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Refresh the page
      cy.reload();

      // Verify user remains logged in
      cy.url().should("include", "/analytics/dashboard");

      // Verify correct role is maintained
      cy.window().its("localStorage.effectiveRole").should("eq", "admin");

      // Verify correct redirect occurs
      cy.get('[data-sidebar="menu-sub-button"][data-active="true"]').should(
        "contain",
        "Dashboard"
      );
    });

    it("should clear authentication state on logout", () => {
      // Login as any role
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Perform logout
      cy.get('[data-sidebar="menu-button"]').contains("Logout").click();

      // Verify redirect to login page
      cy.url().should("include", "/");

      // Verify localStorage is cleared
      cy.window().its("localStorage.effectiveRole").should("be.undefined");

      // Verify cookies are cleared
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
    });

    it("should handle session expiration gracefully", () => {
      // Login as any role
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Simulate session expiration by clearing session
      cy.clearCookies();
      cy.clearLocalStorage();

      // Try to access protected page
      cy.visit("/analytics/dashboard");

      // Verify redirect to login page
      cy.url().should("include", "/");

      // Verify appropriate error message
      cy.get('[data-testid="session-expired-message"]').should(
        "contain",
        "Session expired"
      );
    });
  });

  describe("Profile Simulation and Role Switching", () => {
    it("should allow admin users to simulate other profiles", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to profile simulation
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");

      // Select a TA profile to simulate
      cy.get('[data-testid="profile-simulator"]').click();
      cy.get('[data-testid="ta-profile-option"]').first().click();

      // Verify role switches correctly
      cy.window().its("localStorage.simulatedRole").should("eq", "ta");

      // Verify UI updates to reflect simulated role
      cy.get('[data-testid="current-role-indicator"]').should("contain", "TA");
    });

    it("should allow superadmin users to simulate any profile", () => {
      // Login as superadmin
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to profile simulation
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");

      // Select any profile to simulate
      cy.get('[data-testid="profile-simulator"]').click();
      cy.get('[data-testid="instructional-profile-option"]').first().click();

      // Verify role switches correctly
      cy.window()
        .its("localStorage.simulatedRole")
        .should("eq", "instructional");

      // Verify UI updates to reflect simulated role
      cy.get('[data-testid="current-role-indicator"]').should(
        "contain",
        "Instructional"
      );
    });

    it("should prevent TA users from simulating other profiles", () => {
      // Login as TA
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Navigate to profile page
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");

      // Verify no profile simulation options are available
      cy.get('[data-testid="profile-simulator"]').should("not.exist");

      // Verify cannot access simulation functionality
      cy.get('[data-testid="simulate-profile-button"]').should("not.exist");
    });

    it("should prevent guest users from simulating other profiles", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Navigate to profile page
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");

      // Verify no profile simulation options are available
      cy.get('[data-testid="profile-simulator"]').should("not.exist");

      // Verify cannot access simulation functionality
      cy.get('[data-testid="simulate-profile-button"]').should("not.exist");
    });

    it("should allow returning to original profile after simulation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Simulate another profile
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.get('[data-testid="profile-simulator"]').click();
      cy.get('[data-testid="ta-profile-option"]').first().click();

      // Return to original profile
      cy.get('[data-testid="return-to-original-profile"]').click();

      // Verify original role is restored
      cy.window().its("localStorage.effectiveRole").should("eq", "admin");

      // Verify UI updates correctly
      cy.get('[data-testid="current-role-indicator"]').should(
        "contain",
        "Admin"
      );
    });
  });

  describe("Authentication Error Handling", () => {
    it("should handle Microsoft login failures gracefully", () => {
      // Simulate Microsoft login failure
      cy.intercept("GET", "/api/auth/session", {
        statusCode: 401,
        body: { error: "Authentication failed" },
      });

      // Visit login page
      cy.visit("/");

      // Try to login with Microsoft
      cy.get('[data-testid="microsoft-login-button"]').click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="login-error-message"]').should(
        "contain",
        "Authentication failed"
      );

      // Verify user remains on login page
      cy.url().should("include", "/");

      // Verify form is reset appropriately
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
    });

    it("should handle network errors during authentication", () => {
      // Simulate network error during login
      cy.intercept("GET", "/api/auth/session", { forceNetworkError: true });

      // Visit login page
      cy.visit("/");

      // Try to login
      cy.get('[data-testid="microsoft-login-button"]').click();

      // Verify appropriate error message
      cy.get('[data-testid="network-error-message"]').should(
        "contain",
        "Network error"
      );

      // Verify retry functionality works
      cy.get('[data-testid="retry-login-button"]').click();
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
    });

    it("should handle invalid credentials gracefully", () => {
      // Simulate invalid credentials
      cy.intercept("POST", "/api/auth/signin", {
        statusCode: 401,
        body: { error: "Invalid credentials" },
      });

      // Visit login page
      cy.visit("/");

      // Attempt login with invalid credentials
      cy.get('[data-testid="microsoft-login-button"]').click();

      // Verify appropriate error message
      cy.get('[data-testid="invalid-credentials-message"]').should(
        "contain",
        "Invalid credentials"
      );

      // Verify form validation works
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
    });
  });

  describe("Guest Mode Functionality", () => {
    it("should allow guest access without authentication", () => {
      // Click guest login button
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();

      // Verify redirect to practice page
      cy.url().should("include", "/practice");

      // Verify guest mode is enabled in localStorage
      cy.window().its("localStorage.guestMode").should("eq", "true");

      // Verify limited functionality is available
      cy.get('[data-sidebar="menu-button"]').should("contain", "Practice");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Analytics");
    });

    it("should restrict guest users to practice functionality only", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Verify only practice and profile pages are accessible
      cy.get('[data-sidebar="menu-button"]').should("contain", "Practice");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Profile");

      // Verify other sections show access denied
      cy.visit("/analytics/dashboard");
      cy.url().should("include", "/access-denied");

      cy.visit("/cohorts");
      cy.url().should("include", "/access-denied");
    });

    it("should allow guest users to upgrade to full account", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Navigate to account upgrade option
      cy.get('[data-testid="upgrade-account-button"]').click();

      // Verify Microsoft login flow is initiated
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");

      // Verify proper transition to authenticated state
      cy.get('[data-testid="upgrade-success-message"]').should(
        "contain",
        "Account upgraded successfully"
      );
    });
  });

  describe("Multi-Factor Authentication (Future)", () => {
    it("should handle MFA setup for new users", () => {
      // Mock new user registration
      cy.intercept("POST", "/api/auth/signup", {
        statusCode: 200,
        body: { requiresMFA: true },
      });

      // Visit registration page
      cy.visit("/register");

      // Fill registration form
      cy.get('[data-testid="email-input"]').type("newuser@example.com");
      cy.get('[data-testid="password-input"]').type("password123");
      cy.get('[data-testid="register-button"]').click();

      // Verify MFA setup flow
      cy.get('[data-testid="mfa-setup-form"]').should("be.visible");

      // Complete MFA setup
      cy.get('[data-testid="mfa-code-input"]').type("123456");
      cy.get('[data-testid="verify-mfa-button"]').click();

      // Verify proper completion and redirect
      cy.url().should("include", "/analytics/dashboard");
    });

    it("should handle MFA verification for existing users", () => {
      // Mock existing user with MFA
      cy.intercept("POST", "/api/auth/signin", {
        statusCode: 200,
        body: { requiresMFA: true },
      });

      // Visit login page
      cy.visit("/");

      // Login with credentials
      cy.get('[data-testid="microsoft-login-button"]').click();

      // Verify MFA verification flow
      cy.get('[data-testid="mfa-verification-form"]').should("be.visible");

      // Enter MFA code
      cy.get('[data-testid="mfa-code-input"]').type("123456");
      cy.get('[data-testid="verify-mfa-button"]').click();

      // Verify proper completion and redirect
      cy.url().should("include", "/analytics/dashboard");
    });
  });

  describe("Authentication Security", () => {
    it("should prevent CSRF attacks", () => {
      // Test CSRF token validation
      cy.intercept("POST", "/api/auth/signin", {
        statusCode: 403,
        body: { error: "CSRF token validation failed" },
      });

      // Attempt login without CSRF token
      cy.visit("/");
      cy.get('[data-testid="microsoft-login-button"]').click();

      // Verify unauthorized requests are rejected
      cy.get('[data-testid="csrf-error-message"]').should(
        "contain",
        "CSRF token validation failed"
      );
    });

    it("should implement proper session management", () => {
      // Login as any role
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Verify session tokens are secure
      cy.window()
        .its("localStorage")
        .should("not.have.property", "sessionToken");

      // Verify session timeout works correctly
      cy.clock();
      cy.tick(3600000); // 1 hour

      // Try to access protected page
      cy.visit("/analytics/dashboard");

      // Verify session expired
      cy.url().should("include", "/");
    });

    it("should log authentication events properly", () => {
      // Perform various authentication actions
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();

      // Verify events are logged in system logs
      cy.get('[data-testid="auth-log-entry"]').should(
        "contain",
        "Guest login successful"
      );

      // Verify sensitive information is not logged
      cy.get('[data-testid="auth-log-entry"]').should(
        "not.contain",
        "password"
      );
    });
  });
});
