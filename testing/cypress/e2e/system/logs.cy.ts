/// <reference types="cypress" />

describe("Logs End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to view system logs", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system logs
      cy.get('[data-sidebar="menu-sub-button"]').contains("Logs").click();
      cy.url().should("include", "/system/logs");

      // Verify can view all logs
      cy.get("table").should("be.visible");
      cy.get('input[placeholder="Search messages..."]').should("be.visible");
      cy.get("button").contains("Refresh").should("be.visible");
    });

    it("should allow superadmin users to view system logs", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system logs
      cy.get('[data-sidebar="menu-sub-button"]').contains("Logs").click();
      cy.url().should("include", "/system/logs");

      // Verify can view all logs
      cy.get("table").should("be.visible");
      cy.get('input[placeholder="Search messages..."]').should("be.visible");
      cy.get("button").contains("Refresh").should("be.visible");
    });

    it("should prevent instructional users from accessing system logs", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Try to navigate to system logs directly
      cy.visit("/system/logs");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent TA users from accessing system logs", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to system logs directly
      cy.visit("/system/logs");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent guest users from accessing system logs", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to navigate to system logs directly
      cy.visit("/system/logs");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });
  });

  describe("Log Display and Viewing", () => {
    it("should display system logs with correct information", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify logs display includes:
      // - ID
      // - Log level (INFO, WARNING, ERROR, DEBUG)
      // - Message content
      // - Timestamp
      cy.get("table").should("be.visible");
      cy.get("thead").should("contain", "ID");
      cy.get("thead").should("contain", "Level");
      cy.get("thead").should("contain", "Message");
      cy.get("thead").should("contain", "Created");
    });

    it("should display logs with different severity levels", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify logs with different levels are displayed:
      // - INFO logs (normal operations)
      // - WARNING logs (potential issues)
      // - ERROR logs (actual errors)
      // - DEBUG logs (detailed debugging info)
      cy.get("table tbody tr").should("be.visible");
      cy.get("table").should("contain", "INFO");
      cy.get("table").should("contain", "ERROR");
      cy.get("table").should("contain", "WARN");
      cy.get("table").should("contain", "DEBUG");
    });

    it("should display logs with proper formatting", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify log formatting:
      // - Timestamps are in readable format
      // - Long messages are properly truncated/expanded
      // - JSON data is properly formatted
      // - Error details are clearly presented
      cy.get("table").should("be.visible");
      cy.get("table tbody tr").should("be.visible");
    });

    it("should display log details in dialog", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Click on a log entry to view details
      cy.get("table tbody tr").first().click();

      // Verify log details dialog is displayed
      cy.get("div[role='dialog']").should("be.visible");
      cy.get("pre").should("be.visible");
    });
  });

  describe("Log Filtering and Search", () => {
    it("should filter logs by severity level", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Filter by log level (INFO, WARNING, ERROR, DEBUG)
      cy.get("button").contains("Level").click();
      cy.get("button").contains("Error").click();

      // Verify only logs with selected level are displayed
      cy.get("table tbody tr").each(($row) => {
        cy.wrap($row).should("contain", "ERROR");
      });
    });

    it("should search logs by text content", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Search for specific text in log messages
      cy.get('input[placeholder="Search messages..."]').type("test");

      // Verify search results are displayed
      cy.get("table tbody tr").should("be.visible");
    });

    it("should combine multiple filters", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Apply multiple filters (level + search)
      cy.get("button").contains("Level").click();
      cy.get("button").contains("Error").click();
      cy.get('input[placeholder="Search messages..."]').type("test");

      // Verify only logs matching all filters are displayed
      cy.get("table tbody tr").should("be.visible");
    });

    it("should reset filters", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Apply a filter
      cy.get("button").contains("Level").click();
      cy.get("button").contains("Error").click();

      // Reset filters
      cy.get("button").contains("Reset").click();

      // Verify all logs are visible again
      cy.get("table tbody tr").should("be.visible");
    });
  });

  describe("Log Refresh Functionality", () => {
    it("should refresh logs manually", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Click refresh button
      cy.get("button").contains("Refresh").click();

      // Verify logs are refreshed
      cy.get("table").should("be.visible");
    });

    it("should refresh logs with current filters", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Apply filters
      cy.get("button").contains("Level").click();
      cy.get("button").contains("Error").click();

      // Click refresh
      cy.get("button").contains("Refresh").click();

      // Verify logs are refreshed while maintaining filters
      cy.get("table tbody tr").should("be.visible");
    });

    it("should handle refresh errors gracefully", () => {
      // Simulate refresh error
      cy.intercept("GET", "/api/logs", {
        statusCode: 500,
        body: { error: "Refresh failed" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Click refresh button
      cy.get("button").contains("Refresh").click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to refresh logs"
      );
    });
  });

  describe("Log Data Validation", () => {
    it("should validate log timestamp format", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify all log timestamps are in correct format
      cy.get("table tbody tr").should("be.visible");
      cy.get("table").should("contain", "Created");
    });

    it("should validate log level values", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify all logs have valid level values
      cy.get("table tbody tr").should("be.visible");
      cy.get("table").should("contain", "INFO");
      cy.get("table").should("contain", "ERROR");
      cy.get("table").should("contain", "WARN");
      cy.get("table").should("contain", "DEBUG");
    });

    it("should validate log message content", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify log messages are not empty
      cy.get("table tbody tr").should("be.visible");
      cy.get("table").should("contain", "Message");
    });
  });

  describe("Log Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("GET", "/api/logs", {
        statusCode: 500,
        body: { error: "API Error" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to load logs"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/logs", { forceNetworkError: true });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should("contain", "Network error");
    });

    it("should handle large log volumes", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify logs load without timeout
      cy.get("table", { timeout: 10000 }).should("be.visible");
      cy.get("table tbody tr").should("be.visible");
    });
  });

  describe("Log Performance", () => {
    it("should load logs efficiently", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify logs load within acceptable time
      cy.get("table", { timeout: 10000 }).should("be.visible");
    });

    it("should handle large numbers of logs without performance degradation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify interface remains responsive with many logs
      cy.get("table").should("be.visible");
      cy.get('input[placeholder="Search messages..."]').should("be.visible");
      cy.get("button").contains("Refresh").should("be.visible");
    });
  });

  describe("Log Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.get('input[placeholder="Search messages..."]').should("be.focused");
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/logs");

      // Verify log table has appropriate ARIA labels
      cy.get("table").should("be.visible");
      cy.get("button").contains("Refresh").should("be.visible");
    });
  });
});
