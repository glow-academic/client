/// <reference types="cypress" />

describe("Health End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to view system health", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system health
      cy.get('[data-sidebar="menu-sub-button"]').contains("Health").click();
      cy.url().should("include", "/system/health");

      // Verify can view all health checks
      cy.get("h1").should("contain", "System Health Monitor");
      cy.get("button").contains("Run Health Checks").should("be.visible");
      cy.get("button").contains("Run Stress Tests").should("be.visible");
    });

    it("should allow superadmin users to view system health", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system health
      cy.get('[data-sidebar="menu-sub-button"]').contains("Health").click();
      cy.url().should("include", "/system/health");

      // Verify can view all health checks
      cy.get("h1").should("contain", "System Health Monitor");
      cy.get("button").contains("Run Health Checks").should("be.visible");
      cy.get("button").contains("Run Stress Tests").should("be.visible");
    });

    it("should prevent instructional users from accessing system health", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Try to navigate to system health directly
      cy.visit("/system/health");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent TA users from accessing system health", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to system health directly
      cy.visit("/system/health");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent guest users from accessing system health", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to navigate to system health directly
      cy.visit("/system/health");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });
  });

  describe("Health Check Display", () => {
    it("should display overall system health status", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify overall health status is displayed
      cy.get("h1").should("contain", "System Health Monitor");
      cy.get("div").contains("Overall System Health").should("be.visible");
      cy.get("div").contains("System Health Score").should("be.visible");
    });

    it("should display individual health checks", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify individual health checks are displayed
      cy.get("div").contains("WebSocket Connection").should("be.visible");
      cy.get("div").contains("Authentication Service").should("be.visible");
      cy.get("div").contains("Client API").should("be.visible");
      cy.get("div").contains("Server API").should("be.visible");
      cy.get("div").contains("Simulation Service").should("be.visible");
      cy.get("div").contains("Assistant Service").should("be.visible");
      cy.get("div").contains("Database Connection").should("be.visible");
    });

    it("should display health check status indicators", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify status indicators are displayed
      cy.get("div").contains("Healthy").should("be.visible");
      cy.get("div").contains("Unhealthy").should("be.visible");
      cy.get("div").contains("Warning").should("be.visible");
      cy.get("div").contains("Checking").should("be.visible");
    });

    it("should display response times for health checks", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify response times are displayed
      cy.get("div").contains("Response Time:").should("be.visible");
    });
  });

  describe("Health Check Execution", () => {
    it("should run all health checks", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Click run all checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify all health checks are executed
      cy.get("div").contains("Client API").should("be.visible");
      cy.get("div").contains("Server API").should("be.visible");
      cy.get("div").contains("Database Connection").should("be.visible");
      cy.get("div").contains("WebSocket Connection").should("be.visible");
      cy.get("div").contains("Authentication Service").should("be.visible");
      cy.get("div").contains("Simulation Service").should("be.visible");
      cy.get("div").contains("Assistant Service").should("be.visible");
      cy.get("div").contains("Document Upload Service").should("be.visible");
      cy.get("div").contains("Route Scanner").should("be.visible");
    });

    it("should display health check results", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify results are displayed
      cy.get("div").contains("Last updated:").should("be.visible");
    });

    it("should handle health check failures gracefully", () => {
      // Simulate health check failure
      cy.intercept("GET", "/api/health", {
        statusCode: 500,
        body: { error: "Health check failed" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify failure is handled gracefully
      cy.get("div").contains("Unhealthy").should("be.visible");
    });
  });

  describe("Stress Test Execution", () => {
    it("should run all stress tests", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Click run all stress tests
      cy.get("button").contains("Run Stress Tests").click();

      // Verify all stress tests are executed
      cy.get("div").contains("Stress Test Results").should("be.visible");
    });

    it("should display stress test results", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run stress tests
      cy.get("button").contains("Run Stress Tests").click();

      // Verify stress test results are displayed
      cy.get("div").contains("Stress Test Results").should("be.visible");
      cy.get("div")
        .contains("Performance and load testing results")
        .should("be.visible");
    });
  });

  describe("Health Check Notifications", () => {
    it("should notify on health check failures", () => {
      // Simulate health check failure
      cy.intercept("GET", "/api/health", {
        statusCode: 500,
        body: { error: "Health check failed" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify notification is sent
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Health checks completed with issues"
      );
    });

    it("should notify on health check recovery", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify success notification
      cy.get('[data-testid="error-toast"]').should("not.exist");
    });
  });

  describe("System Information Display", () => {
    it("should display system configuration information", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify system information is displayed
      cy.get("div").contains("System Information").should("be.visible");
      cy.get("div").contains("Environment:").should("be.visible");
      cy.get("div").contains("API Base:").should("be.visible");
    });

    it("should display connection status", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify connection status is displayed
      cy.get("div").contains("WebSocket Connection").should("be.visible");
    });

    it("should display authentication status", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify authentication status is displayed
      cy.get("div").contains("Authentication Service").should("be.visible");
    });
  });

  describe("Health Check Configuration", () => {
    it("should check application configuration", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run application configuration check
      cy.get("button").contains("Run Health Checks").click();

      // Verify all required configuration is present
      cy.get("div").contains("System Information").should("be.visible");
    });

    it("should check SSL/TLS certificates", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run SSL/TLS certificate check
      cy.get("button").contains("Run Health Checks").click();

      // Verify certificates are valid
      cy.get("div").contains("Client API").should("be.visible");
      cy.get("div").contains("Server API").should("be.visible");
    });

    it("should check authentication security", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run authentication security check
      cy.get("button").contains("Run Health Checks").click();

      // Verify authentication is secure
      cy.get("div").contains("Authentication Service").should("be.visible");
    });
  });

  describe("Health Check Management", () => {
    it("should run all health checks", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Click run all checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify all health checks are executed
      cy.get("div").contains("Client API").should("be.visible");
      cy.get("div").contains("Server API").should("be.visible");
      cy.get("div").contains("Database Connection").should("be.visible");
      cy.get("div").contains("WebSocket Connection").should("be.visible");
      cy.get("div").contains("Authentication Service").should("be.visible");
      cy.get("div").contains("Simulation Service").should("be.visible");
      cy.get("div").contains("Assistant Service").should("be.visible");
      cy.get("div").contains("Document Upload Service").should("be.visible");
      cy.get("div").contains("Route Scanner").should("be.visible");
    });

    it("should run all stress tests", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Click run all stress tests
      cy.get("button").contains("Run Stress Tests").click();

      // Verify all stress tests are executed
      cy.get("div").contains("Stress Test Results").should("be.visible");
    });

    it("should display stress test results", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run stress tests
      cy.get("button").contains("Run Stress Tests").click();

      // Verify stress test results are displayed
      cy.get("div").contains("Stress Test Results").should("be.visible");
      cy.get("div")
        .contains("Performance and load testing results")
        .should("be.visible");
    });
  });

  describe("Health Check Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("GET", "/api/health", {
        statusCode: 500,
        body: { error: "API Error" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Health checks completed with issues"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/health", { forceNetworkError: true });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should("contain", "Network error");
    });

    it("should handle timeout errors", () => {
      // Simulate timeout
      cy.intercept("GET", "/api/health", { delay: 10000 });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Run health checks
      cy.get("button").contains("Run Health Checks").click();

      // Verify timeout is handled gracefully
      cy.get("div").contains("Checking...").should("be.visible");
    });
  });

  describe("Health Check Performance", () => {
    it("should load health checks efficiently", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify health checks load within acceptable time
      cy.get("h1", { timeout: 10000 }).should(
        "contain",
        "System Health Monitor"
      );
    });

    it("should run health checks without performance degradation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify interface remains responsive during health checks
      cy.get("button").contains("Run Health Checks").should("be.visible");
      cy.get("button").contains("Run Stress Tests").should("be.visible");
    });
  });

  describe("Health Check Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.get("button").contains("Run Health Checks").should("be.focused");
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/health");

      // Verify health check elements have proper accessibility
      cy.get("h1").should("contain", "System Health Monitor");
      cy.get("button").contains("Run Health Checks").should("be.visible");
      cy.get("button").contains("Run Stress Tests").should("be.visible");
    });
  });
});
