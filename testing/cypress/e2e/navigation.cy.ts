/// <reference types="cypress" />

describe("Navigation End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Navigation", () => {
    it.skip("should show correct sidebar options for guest users", () => {
      // Login as guest using data-testid="guest-login-button"
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.url().should("include", "/practice");

      // Verify sidebar only shows:
      // - Practice (active) - should be highlighted
      // - Profile dropdown in footer
      cy.get('[data-sidebar="menu-button"]').should("contain", "Practice");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should(
        "not.contain",
        "Management"
      );
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");

      // Verify Practice is active
      cy.get('[data-sidebar="menu-button"][data-active="true"]').should(
        "contain",
        "Practice"
      );
    });

    it.skip("should show correct sidebar options for TA users", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Verify sidebar shows:
      // - Home (active) - should be highlighted
      // - Practice
      // - Profile dropdown in footer
      cy.get('[data-sidebar="menu-button"]').should("contain", "Home");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Practice");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should(
        "not.contain",
        "Management"
      );
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");

      // Verify Home is active
      cy.get('[data-sidebar="menu-button"][data-active="true"]').should(
        "contain",
        "Home"
      );
    });

    it.skip("should show correct sidebar options for instructional users", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Verify sidebar shows:
      // - Analytics (collapsible with submenu: Dashboard, Reports, Leaderboard)
      // - Create (collapsible with submenu: Cohorts, Personas, Documents, Scenarios, Simulations, Rubrics)
      // - Profile dropdown in footer
      cy.get('[data-sidebar="menu-button"]').should("contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should(
        "not.contain",
        "Management"
      );
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");

      // Verify Analytics submenu items
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Dashboard");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Reports");
      cy.get('[data-sidebar="menu-sub-button"]').should(
        "contain",
        "Leaderboard"
      );

      // Verify Create submenu items
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Personas");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Documents");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Scenarios");
      cy.get('[data-sidebar="menu-sub-button"]').should(
        "contain",
        "Simulations"
      );
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Rubrics");

      // Verify Analytics is active (Dashboard should be highlighted)
      cy.get('[data-sidebar="menu-sub-button"][data-active="true"]').should(
        "contain",
        "Dashboard"
      );
    });

    it.skip("should show correct sidebar options for admin users", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Verify sidebar shows:
      // - Analytics (collapsible with submenu: Dashboard, Reports, Leaderboard)
      // - Create (collapsible with submenu: Cohorts, Personas, Documents, Scenarios, Simulations, Rubrics)
      // - Management (collapsible with submenu: Staff, Providers, Parameters)
      // - Profile dropdown in footer
      cy.get('[data-sidebar="menu-button"]').should("contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Management");
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");

      // Verify Management submenu items
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Staff");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Providers");
      cy.get('[data-sidebar="menu-sub-button"]').should(
        "contain",
        "Parameters"
      );

      // Verify Analytics is active (Dashboard should be highlighted)
      cy.get('[data-sidebar="menu-sub-button"][data-active="true"]').should(
        "contain",
        "Dashboard"
      );
    });

    it.skip("should show correct sidebar options for superadmin users", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Verify sidebar shows:
      // - Analytics (collapsible with submenu: Dashboard, Reports, Leaderboard)
      // - Create (collapsible with submenu: Cohorts, Personas, Documents, Scenarios, Simulations, Rubrics)
      // - Management (collapsible with submenu: Staff, Providers, Parameters)
      // - System (collapsible with submenu: Agents, Feedback, Logs, Health)
      // - Profile dropdown in footer
      cy.get('[data-sidebar="menu-button"]').should("contain", "Analytics");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Create");
      cy.get('[data-sidebar="menu-button"]').should("contain", "Management");
      cy.get('[data-sidebar="menu-button"]').should("contain", "System");

      // Verify System submenu items
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Agents");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Feedback");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Logs");
      cy.get('[data-sidebar="menu-sub-button"]').should("contain", "Health");

      // Verify Analytics is active (Dashboard should be highlighted)
      cy.get('[data-sidebar="menu-sub-button"][data-active="true"]').should(
        "contain",
        "Dashboard"
      );
    });
  });

  describe("Navigation Functionality", () => {
    it.skip("should navigate to correct routes when clicking sidebar items", () => {
      // Login as admin to access all sections
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Test Analytics navigation
      cy.get('[data-sidebar="menu-sub-button"]').contains("Reports").click();
      cy.url().should("include", "/analytics/reports");

      cy.get('[data-sidebar="menu-sub-button"]')
        .contains("Leaderboard")
        .click();
      cy.url().should("include", "/analytics/leaderboard");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Dashboard").click();
      cy.url().should("include", "/analytics/dashboard");

      // Test Create navigation
      cy.get('[data-sidebar="menu-sub-button"]').contains("Personas").click();
      cy.url().should("include", "/create/personas");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Documents").click();
      cy.url().should("include", "/create/documents");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Scenarios").click();
      cy.url().should("include", "/create/scenarios");

      cy.get('[data-sidebar="menu-sub-button"]')
        .contains("Simulations")
        .click();
      cy.url().should("include", "/create/simulations");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Rubrics").click();
      cy.url().should("include", "/create/rubrics");

      // Test Management navigation
      cy.get('[data-sidebar="menu-sub-button"]').contains("Staff").click();
      cy.url().should("include", "/management/staff");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Providers").click();
      cy.url().should("include", "/management/providers");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Parameters").click();
      cy.url().should("include", "/management/parameters");
    });

    it.skip("should navigate to correct routes for superadmin system section", () => {
      // Login as superadmin
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Test System navigation
      cy.get('[data-sidebar="menu-sub-button"]').contains("Agents").click();
      cy.url().should("include", "/system/agents");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Feedback").click();
      cy.url().should("include", "/system/feedback");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Logs").click();
      cy.url().should("include", "/system/logs");

      cy.get('[data-sidebar="menu-sub-button"]').contains("Health").click();
      cy.url().should("include", "/system/health");
    });

    it.skip("should navigate to correct routes for TA users", () => {
      // Login as TA
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Test Home navigation
      cy.get('[data-sidebar="menu-button"]').contains("Home").click();
      cy.url().should("include", "/home");

      // Test Practice navigation
      cy.get('[data-sidebar="menu-button"]').contains("Practice").click();
      cy.url().should("include", "/practice");
    });

    it.skip("should navigate to correct routes for guest users", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.url().should("include", "/practice");

      // Test Practice navigation (only option available)
      cy.get('[data-sidebar="menu-button"]').contains("Practice").click();
      cy.url().should("include", "/practice");
    });
  });

  describe("Access Control", () => {
    it.skip("should prevent unauthorized access to restricted sections", () => {
      // Login as TA (limited access)
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to access restricted routes directly
      cy.visit("/analytics/dashboard");
      cy.url().should("include", "/access-denied");

      cy.visit("/create/personas");
      cy.url().should("include", "/access-denied");

      cy.visit("/management/staff");
      cy.url().should("include", "/access-denied");

      cy.visit("/system/agents");
      cy.url().should("include", "/access-denied");
    });

    it.skip("should prevent guest users from accessing restricted sections", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();

      // Try to access restricted routes directly
      cy.visit("/home");
      cy.url().should("include", "/access-denied");

      cy.visit("/analytics/dashboard");
      cy.url().should("include", "/access-denied");

      cy.visit("/create/personas");
      cy.url().should("include", "/access-denied");
    });

    it.skip("should allow appropriate access for each role", () => {
      // Test admin access
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");
      cy.url().should("include", "/analytics/dashboard");

      cy.visit("/create/personas");
      cy.url().should("include", "/create/personas");

      cy.visit("/management/staff");
      cy.url().should("include", "/management/staff");

      // Admin should not have access to system section
      cy.visit("/system/agents");
      cy.url().should("include", "/access-denied");

      // Test superadmin access
      cy.mockSession({ role: "superadmin" });
      cy.visit("/system/agents");
      cy.url().should("include", "/system/agents");
    });
  });

  describe("Breadcrumb Navigation", () => {
    it.skip("should display correct breadcrumbs for each section", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Verify breadcrumbs are displayed
      cy.get('[data-testid="breadcrumb"]').should("be.visible");

      // Test breadcrumb navigation
      cy.get('[data-testid="breadcrumb"]').contains("Analytics").click();
      cy.url().should("include", "/analytics");

      cy.visit("/create/personas");
      cy.get('[data-testid="breadcrumb"]').contains("Create").click();
      cy.url().should("include", "/create");

      cy.visit("/management/staff");
      cy.get('[data-testid="breadcrumb"]').contains("Management").click();
      cy.url().should("include", "/management");
    });

    it.skip("should allow navigation via breadcrumbs", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Navigate via breadcrumbs
      cy.get('[data-testid="breadcrumb"]').contains("Dashboard").click();
      cy.url().should("include", "/analytics/dashboard");

      cy.visit("/create/personas/new");
      cy.get('[data-testid="breadcrumb"]').contains("Personas").click();
      cy.url().should("include", "/create/personas");
    });
  });

  describe("Profile Navigation", () => {
    it.skip("should allow profile navigation from sidebar footer", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Click profile dropdown in sidebar footer
      cy.get('[data-sidebar="menu-button"]').contains("Profile").click();
      cy.url().should("include", "/profile");
    });

    it.skip("should allow logout from profile dropdown", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Click profile dropdown and logout
      cy.get('[data-sidebar="menu-button"]').contains("Logout").click();
      cy.url().should("include", "/");
    });
  });

  describe("Search Functionality", () => {
    it.skip("should allow searching within the application", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Use sidebar search
      cy.get('[data-sidebar="input"]').type("test search");
      cy.get('[data-sidebar="input"]').should("have.value", "test search");
    });
  });

  describe("Responsive Navigation", () => {
    it.skip("should handle mobile navigation correctly", () => {
      // Set mobile viewport
      cy.viewport("iphone-x");

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Verify sidebar trigger is visible on mobile
      cy.get('[data-sidebar="trigger"]').should("be.visible");

      // Toggle sidebar
      cy.get('[data-sidebar="trigger"]').click();
      cy.get('[data-slot="sidebar"]').should("be.visible");

      // Close sidebar
      cy.get('[data-sidebar="trigger"]').click();
      cy.get('[data-slot="sidebar"]').should("not.be.visible");
    });

    it.skip("should handle tablet navigation correctly", () => {
      // Set tablet viewport
      cy.viewport("ipad-2");

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Verify sidebar behavior on tablet
      cy.get('[data-sidebar="trigger"]').should("be.visible");
    });
  });

  describe("Navigation State Management", () => {
    it.skip("should maintain navigation state across page refreshes", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to a specific page
      cy.get('[data-sidebar="menu-sub-button"]').contains("Reports").click();
      cy.url().should("include", "/analytics/reports");

      // Refresh the page
      cy.reload();

      // Verify we're still on the same page
      cy.url().should("include", "/analytics/reports");
      cy.get('[data-sidebar="menu-sub-button"][data-active="true"]').should(
        "contain",
        "Reports"
      );
    });

    it.skip("should handle browser back/forward navigation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to different pages
      cy.get('[data-sidebar="menu-sub-button"]').contains("Reports").click();
      cy.url().should("include", "/analytics/reports");

      cy.get('[data-sidebar="menu-sub-button"]')
        .contains("Leaderboard")
        .click();
      cy.url().should("include", "/analytics/leaderboard");

      // Use browser back
      cy.go("back");
      cy.url().should("include", "/analytics/reports");

      // Use browser forward
      cy.go("forward");
      cy.url().should("include", "/analytics/leaderboard");
    });
  });
});
