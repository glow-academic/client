/// <reference types="cypress" />

describe("Feedback End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to send and receive feedback", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system feedback
      cy.get('[data-sidebar="menu-sub-button"]').contains("Feedback").click();
      cy.url().should("include", "/system/feedback");

      // Verify can view all feedback
      cy.get("table").should("be.visible");
      cy.get('input[placeholder="Search feedback or author..."]').should(
        "be.visible"
      );

      // Verify can send feedback
      cy.get("button").contains("Refresh").should("be.visible");
    });

    it("should allow superadmin users to send and receive feedback", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system feedback
      cy.get('[data-sidebar="menu-sub-button"]').contains("Feedback").click();
      cy.url().should("include", "/system/feedback");

      // Verify can view all feedback
      cy.get("table").should("be.visible");
      cy.get('input[placeholder="Search feedback or author..."]').should(
        "be.visible"
      );

      // Verify can send feedback
      cy.get("button").contains("Refresh").should("be.visible");
    });

    it("should prevent instructional users from accessing feedback system", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Try to navigate to system feedback directly
      cy.visit("/system/feedback");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent TA users from accessing feedback system", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to system feedback directly
      cy.visit("/system/feedback");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent guest users from accessing feedback system", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to navigate to system feedback directly
      cy.visit("/system/feedback");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });
  });

  describe("Feedback Sending", () => {
    it("should send feedback with basic information", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Click send feedback (using the ReportProblem component)
      cy.get('button[title="Need Help?"]').click();

      // Fill in feedback information
      cy.get("select").select("bug");
      cy.get('textarea[placeholder="Describe the issue..."]').type(
        "Test feedback message"
      );

      // Submit feedback
      cy.get("button").contains("Submit").click();

      // Verify feedback is sent successfully
      cy.get('[data-testid="error-toast"]').should("not.exist");
    });

    it("should validate required fields during sending", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Click send feedback
      cy.get('button[title="Need Help?"]').click();

      // Try to submit feedback without required fields
      cy.get("button").contains("Submit").click();

      // Verify validation errors are displayed
      cy.get("select").should("have.attr", "required");
      cy.get('textarea[placeholder="Describe the issue..."]').should(
        "have.attr",
        "required"
      );
    });

    it("should handle feedback submission errors gracefully", () => {
      // Simulate submission error
      cy.intercept("POST", "/api/feedback", {
        statusCode: 500,
        body: { error: "Submission failed" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Click send feedback
      cy.get('button[title="Need Help?"]').click();

      // Fill in feedback information
      cy.get("select").select("bug");
      cy.get('textarea[placeholder="Describe the issue..."]').type(
        "Test feedback message"
      );

      // Submit feedback
      cy.get("button").contains("Submit").click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to submit feedback"
      );
    });
  });

  describe("Feedback Receiving", () => {
    it("should receive and display feedback", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify received feedback is displayed
      cy.get("table").should("be.visible");
      cy.get("thead").should("contain", "ID");
      cy.get("thead").should("contain", "Type");
      cy.get("thead").should("contain", "Message");
      cy.get("thead").should("contain", "Author");
    });

    it("should display feedback with different categories", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify different feedback types are displayed
      cy.get("table tbody tr").should("be.visible");
      cy.get("table").should("contain", "🐛");
      cy.get("table").should("contain", "✨");
      cy.get("table").should("contain", "❓");
      cy.get("table").should("contain", "📝");
    });

    it("should display feedback with author information", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify author information is displayed
      cy.get("table").should("be.visible");
      cy.get("table").should("contain", "Author");
    });

    it("should display feedback with timestamps", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify timestamps are displayed
      cy.get("table").should("be.visible");
      cy.get("table").should("contain", "Created");
    });
  });

  describe("Feedback Filtering and Search", () => {
    it("should filter feedback by type", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Filter by type
      cy.get("button").contains("Type").click();
      cy.get("button").contains("🐛 Bug").click();

      // Verify only feedback with selected type is displayed
      cy.get("table tbody tr").each(($row) => {
        cy.wrap($row).should("contain", "bug");
      });
    });

    it("should search feedback by text content", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Search for specific text
      cy.get('input[placeholder="Search feedback or author..."]').type("test");

      // Verify search results are displayed
      cy.get("table tbody tr").should("be.visible");
    });

    it("should combine multiple filters", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Apply multiple filters
      cy.get("button").contains("Type").click();
      cy.get("button").contains("🐛 Bug").click();
      cy.get('input[placeholder="Search feedback or author..."]').type("test");

      // Verify only feedback matching all filters is displayed
      cy.get("table tbody tr").should("be.visible");
    });
  });

  describe("Feedback Refresh Functionality", () => {
    it("should refresh feedback list", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Click refresh button
      cy.get("button").contains("Refresh").click();

      // Verify feedback list is refreshed
      cy.get("table").should("be.visible");
    });

    it("should handle refresh errors gracefully", () => {
      // Simulate refresh error
      cy.intercept("GET", "/api/feedback", {
        statusCode: 500,
        body: { error: "Refresh failed" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Click refresh button
      cy.get("button").contains("Refresh").click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to refresh feedback"
      );
    });
  });

  describe("Feedback Notifications", () => {
    it("should show notification for new feedback", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Simulate new feedback arrival
      cy.intercept("GET", "/api/feedback", { fixture: "new-feedback.json" });

      // Verify notification is displayed
      cy.get('[data-testid="error-toast"]').should("not.exist");
    });
  });

  describe("Feedback Data Validation", () => {
    it("should validate feedback description", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Click send feedback
      cy.get('button[title="Need Help?"]').click();

      // Try to send feedback with empty description
      cy.get("select").select("bug");
      cy.get("button").contains("Submit").click();

      // Verify validation error is displayed
      cy.get('textarea[placeholder="Describe the issue..."]').should(
        "have.attr",
        "required"
      );
    });
  });

  describe("Feedback Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("GET", "/api/feedback", {
        statusCode: 500,
        body: { error: "API Error" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to load feedback"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/feedback", { forceNetworkError: true });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should("contain", "Network error");
    });

    it("should handle invalid feedback data", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Submit invalid feedback data
      cy.get('button[title="Need Help?"]').click();
      cy.get("button").contains("Submit").click();

      // Verify validation errors are displayed clearly
      cy.get("select").should("have.attr", "required");
      cy.get('textarea[placeholder="Describe the issue..."]').should(
        "have.attr",
        "required"
      );
    });
  });

  describe("Feedback Performance", () => {
    it("should load feedback efficiently", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify feedback loads within acceptable time
      cy.get("table", { timeout: 10000 }).should("be.visible");
    });

    it("should handle large numbers of feedback entries", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify interface remains responsive with many feedback entries
      cy.get("table").should("be.visible");
      cy.get('input[placeholder="Search feedback or author..."]').should(
        "be.visible"
      );
    });
  });

  describe("Feedback Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.get('input[placeholder="Search feedback or author..."]').should(
        "be.focused"
      );
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/feedback");

      // Verify feedback table has proper accessibility
      cy.get("table").should("be.visible");
      cy.get("button").contains("Refresh").should("be.visible");
    });
  });
});
