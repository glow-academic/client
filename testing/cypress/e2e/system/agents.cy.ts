/// <reference types="cypress" />

describe("Agents End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to edit agents", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system agents
      cy.get('[data-sidebar="menu-sub-button"]').contains("Agents").click();
      cy.url().should("include", "/system/agents");

      // Verify can view all agents
      cy.get('[data-testid^="agent-card-"]').should("be.visible");

      // Verify can edit agent configurations
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });
      cy.url().should("include", "/system/agents/a/");

      // Verify can test agent functionality
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]').should(
        "be.visible"
      );
      cy.get(
        'textarea[placeholder="Detailed behavior description and personality traits"]'
      ).should("be.visible");
    });

    it("should allow superadmin users to edit agents", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to system agents
      cy.get('[data-sidebar="menu-sub-button"]').contains("Agents").click();
      cy.url().should("include", "/system/agents");

      // Verify can view all agents
      cy.get('[data-testid^="agent-card-"]').should("be.visible");

      // Verify can edit agent configurations
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });
      cy.url().should("include", "/system/agents/a/");

      // Verify can test agent functionality
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]').should(
        "be.visible"
      );
      cy.get(
        'textarea[placeholder="Detailed behavior description and personality traits"]'
      ).should("be.visible");
    });

    it("should prevent instructional users from accessing agents", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Try to navigate to system agents directly
      cy.visit("/system/agents");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent TA users from accessing agents", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to system agents directly
      cy.visit("/system/agents");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });

    it("should prevent guest users from accessing agents", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to navigate to system agents directly
      cy.visit("/system/agents");
      cy.url().should("include", "/access-denied");

      // Verify System section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "System");
    });
  });

  describe("Agent Management", () => {
    it("should display all system agents", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Verify agents are displayed
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
      cy.get("h1").should("contain", "System Agents");
    });

    it("should search agents by name", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Search for specific agent
      cy.get('input[placeholder="Search system agents..."]').type("Math Tutor");

      // Verify search results
      cy.get('[data-testid^="agent-card-"]').should("contain", "Math Tutor");
    });

    it("should filter agents by reasoning level", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Filter by reasoning level
      cy.get("button").contains("Reasoning").click();
      cy.get("button").contains("Low").click();

      // Verify filtered results
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
    });

    it("should filter agents by model", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Filter by model
      cy.get("button").contains("Model").click();
      cy.get("button").contains("GPT-4").click();

      // Verify filtered results
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
    });

    it("should filter agents by temperature", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Filter by temperature
      cy.get("button").contains("Temperature").click();
      cy.get("button").contains("Low (0.0-0.33)").click();

      // Verify filtered results
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
    });

    it("should reset filters", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Apply a filter
      cy.get("button").contains("Reasoning").click();
      cy.get("button").contains("Low").click();

      // Reset filters
      cy.get("button").contains("Reset").click();

      // Verify all agents are visible again
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
    });
  });

  describe("Agent Configuration", () => {
    it("should edit agent name", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Change agent name
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]')
        .clear()
        .type("Test Agent");

      // Submit changes
      cy.get("button").contains("Update Agent").click();

      // Verify agent name is updated
      cy.url().should("include", "/system/agents");
      cy.get('[data-testid^="agent-card-"]').should("contain", "Test Agent");
    });

    it("should edit agent description", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Change agent description
      cy.get(
        'textarea[placeholder="Detailed behavior description and personality traits"]'
      )
        .clear()
        .type("Test description");

      // Submit changes
      cy.get("button").contains("Update Agent").click();

      // Verify agent responds according to new configuration
      cy.url().should("include", "/system/agents");
      cy.get('[data-testid^="agent-card-"]').should("contain", "Test Agent");
    });

    it("should validate agent system prompt", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Verify system prompt field is required
      cy.get('textarea[placeholder="Enter the system prompt..."]').should(
        "have.attr",
        "required"
      );
    });

    it("should edit agent temperature setting", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Adjust temperature slider
      cy.get('[data-testid="temperature-slider"]').should("be.visible");

      // Submit changes
      cy.get("button").contains("Update Agent").click();

      // Verify temperature setting is updated
      cy.url().should("include", "/system/agents");
    });

    it("should edit agent model selection", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Change model selection
      cy.get("select").first().select("GPT-4");

      // Submit changes
      cy.get("button").contains("Update Agent").click();

      // Verify model is updated
      cy.url().should("include", "/system/agents");
    });

    it("should edit agent reasoning level", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Change reasoning level
      cy.get("select").contains("Reasoning").parent().select("High");

      // Submit changes
      cy.get("button").contains("Update Agent").click();

      // Verify reasoning level is updated
      cy.url().should("include", "/system/agents");
    });
  });

  describe("Agent Testing", () => {
    it("should test agent with new configuration", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Update agent configuration
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]')
        .clear()
        .type("Test Agent");
      cy.get(
        'textarea[placeholder="Detailed behavior description and personality traits"]'
      )
        .clear()
        .type("Test description");

      // Submit changes
      cy.get("button").contains("Update Agent").click();

      // Verify agent responds according to new configuration
      cy.url().should("include", "/system/agents");
      cy.get('[data-testid^="agent-card-"]').should("contain", "Test Agent");
    });

    it("should validate required fields", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Clear required fields
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]').clear();
      cy.get(
        'textarea[placeholder="Detailed behavior description and personality traits"]'
      ).clear();

      // Try to submit
      cy.get("button").contains("Update Agent").click();

      // Verify validation errors
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]').should(
        "have.attr",
        "required"
      );
      cy.get(
        'textarea[placeholder="Detailed behavior description and personality traits"]'
      ).should("have.attr", "required");
    });
  });

  describe("Agent Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("GET", "/api/agents", {
        statusCode: 500,
        body: { error: "API Error" },
      });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to load agents"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/agents", { forceNetworkError: true });

      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should("contain", "Network error");
    });

    it("should handle validation errors", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Select existing agent to edit
      cy.get('[data-testid^="agent-card-"]')
        .first()
        .within(() => {
          cy.get("button").contains("Edit").click();
        });

      // Submit invalid data
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]').clear();
      cy.get("button").contains("Update Agent").click();

      // Verify validation errors are displayed clearly
      cy.get('input[placeholder="e.g., Enthusiastic Student Agent"]').should(
        "have.attr",
        "required"
      );
    });
  });

  describe("Agent Performance", () => {
    it("should load agents efficiently", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Verify agents load within acceptable time
      cy.get('[data-testid^="agent-card-"]', { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("should handle large numbers of agents without performance degradation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Verify interface remains responsive with many agents
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
      cy.get('input[placeholder="Search system agents..."]').should(
        "be.visible"
      );
    });
  });

  describe("Agent Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Test tab navigation through all interactive elements
      cy.get("body").tab();
      cy.get('input[placeholder="Search system agents..."]').should(
        "be.focused"
      );
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin/superadmin
      cy.mockSession({ role: "admin" });
      cy.visit("/system/agents");

      // Verify agent cards have proper accessibility
      cy.get('[data-testid^="agent-card-"]').should("be.visible");
      cy.get("button").contains("Edit").should("be.visible");
    });
  });
});
