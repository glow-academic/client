/// <reference types="cypress" />

describe("Auth Flows", () => {
  describe("Login Page", () => {
    beforeEach(() => {
      cy.visit("/");
    });

    it("shows Microsoft and Guest login buttons", () => {
      cy.contains("Glow");
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
      cy.get('[data-testid="guest-login-button"]').should("be.visible");
    });

    it("logs in as a guest", () => {
      cy.loginAsGuest();
      cy.url().should("include", "/practice");
    });

    it("logs in as an admin (mocked)", () => {
      cy.loginAsAdmin();
      cy.url().should("include", "/analytics");
      cy.window().its("localStorage.effectiveRole").should("eq", "admin");
    });
  });

  describe("Role-Based Access", () => {
    // Define mock profile objects for each role
    const taProfile = {
      id: "ta-uuid-1234",
      firstName: "Test",
      lastName: "TA",
      alias: "test.ta",
      role: "ta",
      active: true,
      viewedIntro: false,
      viewedChat: false,
      defaultProfile: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userId: 1,
    };

    const instructionalProfile = {
      id: "instructional-uuid-5678",
      firstName: "Test",
      lastName: "Instructional",
      alias: "test.instructional",
      role: "instructional",
      active: true,
      viewedIntro: false,
      viewedChat: false,
      defaultProfile: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userId: 2,
    };

    const superadminProfile = {
      id: "superadmin-uuid-9012",
      firstName: "Test",
      lastName: "Superadmin",
      alias: "test.superadmin",
      role: "superadmin",
      active: true,
      viewedIntro: false,
      viewedChat: false,
      defaultProfile: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userId: 3,
    };

    const rolesConfig = [
      {
        description: "TA",
        profile: taProfile,
        url: "/home",
        visibleItems: ["Home", "Practice"],
        hiddenItems: ["Analytics", "Management"],
      },
      {
        description: "Instructional",
        profile: instructionalProfile,
        url: "/analytics/dashboard",
        visibleItems: ["Analytics", "Create"],
        hiddenItems: ["Management"],
      },
      {
        description: "Superadmin",
        profile: superadminProfile,
        url: "/analytics/dashboard",
        visibleItems: ["Analytics", "Create", "Management", "System"],
        hiddenItems: [],
      },
    ];

    rolesConfig.forEach(
      ({ description, profile, url, visibleItems, hiddenItems }) => {
        it(`should grant access and show the correct UI for a ${description} user`, () => {
          // Use the new, robust login command
          cy.loginAs(profile, url);

          cy.url().should("include", url);
          cy.window()
            .its("localStorage.effectiveRole")
            .should("eq", profile.role);

          cy.get('[data-sidebar="menu-button"]').as("sidebarButtons");

          visibleItems.forEach((item) => {
            cy.get("@sidebarButtons").should("contain", item);
          });

          hiddenItems.forEach((item) => {
            cy.get("@sidebarButtons").should("not.contain", item);
          });
        });
      }
    );
  });

  describe("Authentication State Management", () => {
    it("should maintain authentication state across page refreshes", () => {
      cy.loginAsAdmin();
      cy.reload();

      cy.url().should("include", "/analytics");
      cy.window().its("localStorage.effectiveRole").should("eq", "admin");
      cy.get('[data-sidebar="menu-sub-button"][data-active="true"]').should(
        "contain",
        "Dashboard"
      );
    });

    it("should clear authentication state on logout", () => {
      cy.loginAsAdmin();
      cy.get('[data-sidebar="menu-button"]').contains("Logout").click();

      cy.url().should("include", "/");
      cy.window().its("localStorage.effectiveRole").should("be.undefined");
      cy.window().its("localStorage.guestMode").should("be.undefined");
      cy.window().its("localStorage.simulatedProfileId").should("be.undefined");
      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
    });

    it("should handle session expiration gracefully", () => {
      cy.loginAsAdmin();
      cy.clearCookies();
      cy.clearLocalStorage();
      cy.visit("/analytics/dashboard");

      cy.url().should("include", "/");
      cy.get('[data-testid="session-expired-message"]').should(
        "contain",
        "Session expired"
      );
    });
  });

  describe("Profile Simulation", () => {
    it("should allow an admin to simulate a TA profile", () => {
      // Arrange: Log in as an admin
      cy.loginAsAdmin();

      // Act: Simulate a TA profile using the new command
      cy.doProfileSimulation("ta-profile-option");

      // Assert: Verify the simulation was successful
      cy.window().its("localStorage.simulatedProfileId").should("not.be.null");
      cy.get('[data-testid="current-role-indicator"]').should("contain", "TA");

      // Assert: Verify sidebar updates to the simulated role's permissions
      cy.get('[data-sidebar="menu-button"]')
        .should("contain", "Practice")
        .and("not.contain", "Analytics");
    });

    it("should allow a superadmin to simulate an instructional profile", () => {
      // Arrange
      cy.loginAsSuperadmin();

      // Act
      cy.doProfileSimulation("instructional-profile-option");

      // Assert
      cy.window().its("localStorage.simulatedProfileId").should("not.be.null");
      cy.get('[data-testid="current-role-indicator"]').should(
        "contain",
        "Instructional"
      );
      cy.get('[data-sidebar="menu-button"]')
        .should("contain", "Analytics")
        .and("not.contain", "Management");
    });

    it("should prevent TA users from simulating other profiles", () => {
      cy.loginAsTa();
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");

      // Assert that the simulation UI does not exist for this role
      cy.get('[data-testid="profile-simulator"]').should("not.exist");
    });

    it("should prevent guest users from simulating other profiles", () => {
      cy.loginAsGuest();
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");

      // Assert that the simulation UI does not exist for this role
      cy.get('[data-testid="profile-simulator"]').should("not.exist");
    });

    it("should allow returning to original profile after simulation", () => {
      // Arrange: Login as admin and simulate another profile
      cy.loginAsAdmin();
      cy.doProfileSimulation("ta-profile-option");

      // Act: Return to original profile
      cy.get('[data-testid="return-to-original-profile"]').click();

      // Assert: Verify original role is restored
      cy.window().its("localStorage.effectiveRole").should("eq", "admin");
      cy.get('[data-testid="current-role-indicator"]').should(
        "contain",
        "Admin"
      );
    });
  });

  describe("Authentication Error Handling", () => {
    beforeEach(() => {
      cy.visit("/");
    });

    it("should handle Microsoft login failures gracefully", () => {
      cy.mockInvalidCredentials();
      cy.get('[data-testid="microsoft-login-button"]').click();
      cy.get('[data-testid="invalid-credentials-message"]').should(
        "contain",
        "Invalid credentials"
      );
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });

    it("should handle network errors during authentication", () => {
      cy.mockNetworkError();
      cy.get('[data-testid="microsoft-login-button"]').click();
      cy.get('[data-testid="network-error-message"]').should(
        "contain",
        "Network error"
      );
    });

    it("should handle CSRF attacks", () => {
      cy.mockCSRFError();
      cy.get('[data-testid="microsoft-login-button"]').click();
      cy.get('[data-testid="csrf-error-message"]').should(
        "contain",
        "CSRF token validation failed"
      );
    });
  });

  describe("Guest Mode", () => {
    it("should allow guest access without authentication", () => {
      cy.loginAsGuest();
      cy.url().should("include", "/practice");
      cy.window().its("localStorage.guestMode").should("eq", "true");

      cy.get('[data-sidebar="menu-button"]')
        .should("contain", "Practice")
        .and("not.contain", "Analytics");
    });

    it("should restrict guest users to practice functionality only", () => {
      cy.loginAsGuest();

      cy.get('[data-sidebar="menu-button"]')
        .should("contain", "Practice")
        .and("contain", "Profile");

      cy.visit("/analytics/dashboard");
      cy.url().should("include", "/access-denied");

      cy.visit("/cohorts");
      cy.url().should("include", "/access-denied");
    });

    it("should allow guest users to upgrade to full account", () => {
      cy.loginAsGuest();
      cy.get('[data-testid="upgrade-account-button"]').click();

      cy.get('[data-testid="microsoft-login-button"]').should("be.visible");
      cy.get('[data-testid="upgrade-success-message"]').should(
        "contain",
        "Account upgraded successfully"
      );
    });
  });

  describe("Security", () => {
    it("should implement proper session management", () => {
      cy.loginAsAdmin();

      cy.window()
        .its("localStorage")
        .should("not.have.property", "sessionToken");

      cy.clock();
      cy.tick(3600000); // 1 hour
      cy.visit("/analytics/dashboard");
      cy.url().should("include", "/");
    });

    it("should log authentication events properly", () => {
      cy.loginAsGuest();

      cy.get('[data-testid="auth-log-entry"]')
        .should("contain", "Guest login successful")
        .and("not.contain", "password");
    });
  });
});
