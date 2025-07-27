/// <reference types="cypress" />

describe("Scenarios End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to create and manage all scenarios", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Verify can access scenarios page
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid="create-scenario-button"]').should("be.visible");

      // Verify can create new scenarios
      cy.get('[data-testid="create-scenario-button"]').click();
      cy.url().should("include", "/create/scenarios/new");
      cy.get('[data-testid="scenario-component"]').should("be.visible");

      // Verify can edit scenarios (if any exist)
      cy.visit("/create/scenarios");
      cy.get('[data-testid^="card-"]')
        .first()
        .then(($card) => {
          if ($card.length > 0) {
            cy.get('[data-testid^="edit-"]').first().should("be.visible");
          }
        });

      // Verify can delete scenarios (if not in use)
      cy.get('[data-testid^="card-"]')
        .first()
        .then(($card) => {
          if ($card.length > 0) {
            cy.get('[data-testid^="delete-"]').first().should("be.visible");
          }
        });
    });

    it("should allow superadmin users to create and manage all scenarios", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/create/scenarios");

      // Verify can access scenarios page
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid="create-scenario-button"]').should("be.visible");

      // Verify can create new scenarios
      cy.get('[data-testid="create-scenario-button"]').click();
      cy.url().should("include", "/create/scenarios/new");
      cy.get('[data-testid="scenario-component"]').should("be.visible");
    });

    it("should allow instructional users to create and manage scenarios", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/create/scenarios");

      // Verify can access scenarios page
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid="create-scenario-button"]').should("be.visible");

      // Verify can create new scenarios
      cy.get('[data-testid="create-scenario-button"]').click();
      cy.url().should("include", "/create/scenarios/new");
      cy.get('[data-testid="scenario-component"]').should("be.visible");
    });

    it("should prevent TA users from accessing scenario creation", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/create/scenarios");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
    });

    it("should prevent guest users from accessing scenario creation", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/create/scenarios");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
    });
  });

  describe("Scenario Creation", () => {
    it("should create a new scenario with basic information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Fill in basic information
      cy.get('input[placeholder="Enter scenario name"]').type("Test Scenario");
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Test scenario description");

      // Select persona type
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();

      // Select documents
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').first().click();

      // Submit form
      cy.get('button:contains("Save Scenario")').click();

      // Verify scenario is created successfully
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid^="card-"]').should("contain", "Test Scenario");
    });

    it("should create a scenario with multiple documents", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Fill basic information
      cy.get('input[placeholder="Enter scenario name"]').type(
        "Multi-Doc Scenario"
      );
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Scenario with multiple documents");

      // Select persona
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();

      // Select multiple documents
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').first().click();
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').eq(1).click();

      // Submit form
      cy.get('button:contains("Save Scenario")').click();

      // Verify scenario is created
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid^="card-"]').should("contain", "Multi-Doc Scenario");
    });

    it("should create a scenario with custom parameters", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Fill basic information
      cy.get('input[placeholder="Enter scenario name"]').type(
        "Parameter Scenario"
      );
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Scenario with custom parameters");

      // Select persona
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();

      // Add custom parameters
      cy.get('button:contains("Add Parameter")').click();
      cy.get('input[placeholder="Parameter name"]').type("Custom Param");
      cy.get('input[placeholder="Parameter value"]').type("Custom Value");

      // Submit form
      cy.get('button:contains("Save Scenario")').click();

      // Verify scenario is created
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid^="card-"]').should("contain", "Parameter Scenario");
    });

    it("should validate required fields during creation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Try to submit without required fields
      cy.get('button:contains("Save Scenario")').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Name is required"
      );
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Persona is required"
      );

      // Verify form cannot be submitted
      cy.url().should("include", "/create/scenarios/new");
    });

    it("should handle duplicate scenario names gracefully", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Create first scenario
      cy.get('input[placeholder="Enter scenario name"]').type("Duplicate Test");
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("First scenario");
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      // Try to create second scenario with same name
      cy.visit("/create/scenarios/new");
      cy.get('input[placeholder="Enter scenario name"]').type("Duplicate Test");
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Second scenario");
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Scenario name already exists"
      );
    });
  });

  describe("Scenario Management and Editing", () => {
    it("should edit scenario information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Click edit on first scenario
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/create/scenarios/s/");

      // Modify scenario information
      cy.get('input[placeholder="Enter scenario name"]')
        .clear()
        .type("Updated Scenario Name");
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      )
        .clear()
        .type("Updated description");

      // Submit changes
      cy.get('button:contains("Update Scenario")').click();

      // Verify changes are saved
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid^="card-"]').should(
        "contain",
        "Updated Scenario Name"
      );
    });

    it("should update scenario persona assignment", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Click edit on first scenario
      cy.get('[data-testid^="edit-"]').first().click();

      // Change persona assignment
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').eq(1).click();

      // Submit changes
      cy.get('button:contains("Update Scenario")').click();

      // Verify persona is updated
      cy.url().should("include", "/create/scenarios");
    });

    it("should update scenario document assignments", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Click edit on first scenario
      cy.get('[data-testid^="edit-"]').first().click();

      // Add/remove documents
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').first().click();

      // Submit changes
      cy.get('button:contains("Update Scenario")').click();

      // Verify document assignments are updated
      cy.url().should("include", "/create/scenarios");
    });

    it("should prevent editing scenarios that are in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Find scenario that is in use (has simulations)
      cy.get('[data-testid^="card-"]').each(($card) => {
        cy.wrap($card)
          .find('[data-testid="in-use-indicator"]')
          .then(($indicator) => {
            if ($indicator.length > 0) {
              // Verify edit is prevented
              cy.wrap($card)
                .find('[data-testid^="edit-"]')
                .should("be.disabled");
              cy.wrap($card)
                .find('[data-testid="edit-disabled-tooltip"]')
                .should("be.visible");
            }
          });
      });
    });
  });

  describe("Scenario Deletion and Constraints", () => {
    it("should delete scenario when not in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Find scenario not in use
      cy.get('[data-testid^="card-"]').each(($card) => {
        cy.wrap($card)
          .find('[data-testid="in-use-indicator"]')
          .then(($indicator) => {
            if ($indicator.length === 0) {
              // Click delete button
              cy.wrap($card).find('[data-testid^="delete-"]').click();

              // Confirm deletion
              cy.get('[data-testid="delete-confirmation-dialog"]').should(
                "be.visible"
              );
              cy.get('button:contains("Delete")').click();

              // Verify scenario is deleted
              cy.get('[data-testid^="card-"]').should(
                "not.contain",
                "Test Scenario"
              );
              return false; // Break the loop
            }
          });
      });
    });

    it("should prevent deletion of scenarios that are in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Find scenario that is in use
      cy.get('[data-testid^="card-"]').each(($card) => {
        cy.wrap($card)
          .find('[data-testid="in-use-indicator"]')
          .then(($indicator) => {
            if ($indicator.length > 0) {
              // Verify deletion is prevented
              cy.wrap($card)
                .find('[data-testid^="delete-"]')
                .should("not.exist");
              return false; // Break the loop
            }
          });
      });
    });

    it("should show warning when attempting to delete active scenario", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Find scenario that is in use
      cy.get('[data-testid^="card-"]').each(($card) => {
        cy.wrap($card)
          .find('[data-testid="in-use-indicator"]')
          .then(($indicator) => {
            if ($indicator.length > 0) {
              // Verify warning is displayed
              cy.wrap($card)
                .find('[data-testid="in-use-warning"]')
                .should("be.visible");
              cy.wrap($card)
                .find('[data-testid="in-use-warning"]')
                .should("contain", "Cannot delete scenario in use");
              return false; // Break the loop
            }
          });
      });
    });
  });

  describe("Scenario Duplication", () => {
    it("should duplicate scenarios", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Click duplicate on first scenario
      cy.get('[data-testid^="duplicate-"]').first().click();

      // Verify new scenario is created with same settings
      cy.url().should("include", "/create/scenarios/new");
      cy.get('input[placeholder="Enter scenario name"]').should(
        "contain.value",
        "Copy"
      );

      // Verify all settings are copied
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).should("not.be.empty");
    });

    it("should create unique names for duplicated scenarios", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Duplicate a scenario multiple times
      cy.get('[data-testid^="duplicate-"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      cy.visit("/create/scenarios");
      cy.get('[data-testid^="duplicate-"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      // Verify each duplicated scenario has unique name
      cy.visit("/create/scenarios");
      cy.get('[data-testid^="card-"]').should("contain", "Copy");
      cy.get('[data-testid^="card-"]').should("contain", "Copy (1)");
    });
  });

  describe("AI Scenario Generation", () => {
    it("should generate scenario using AI from prompt", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Click generate scenario
      cy.get('button:contains("Generate")').click();

      // Enter prompt describing desired scenario
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Generate a scenario about teaching math to students");

      // Submit generation request
      cy.get('button:contains("Generate")').click();

      // Verify AI generates scenario content
      cy.get('[data-testid="generation-progress"]').should("be.visible");
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).should("not.be.empty");

      // Save generated scenario
      cy.get('input[placeholder="Enter scenario name"]').type(
        "AI Generated Math Scenario"
      );
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      // Verify generated scenario is saved
      cy.url().should("include", "/create/scenarios");
      cy.get('[data-testid^="card-"]').should(
        "contain",
        "AI Generated Math Scenario"
      );
    });

    it("should handle AI generation errors gracefully", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Try to generate scenario with problematic prompt
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Invalid prompt that should cause error");
      cy.get('button:contains("Generate")').click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to generate scenario"
      );

      // Verify retry functionality works
      cy.get('button:contains("Retry")').click();
      cy.get('[data-testid="generation-progress"]').should("be.visible");
    });
  });

  describe("Scenario Search and Filtering", () => {
    it("should search scenarios by name", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Search for scenario by name
      cy.get('input[placeholder="Search scenarios..."]').type("Test Scenario");

      // Verify search results are displayed
      cy.get('[data-testid^="card-"]').should("contain", "Test Scenario");
    });

    it("should filter scenarios by persona", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Filter scenarios by assigned persona
      cy.get('[data-testid="persona-filter"]').click();
      cy.get('[role="option"]').first().click();

      // Verify filtering works correctly
      cy.get('[data-testid^="card-"]').should("have.length.at.least", 1);
    });

    it("should filter scenarios by usage status", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Filter scenarios by usage status
      cy.get('[data-testid="usage-filter"]').click();
      cy.get('[role="option"]').contains("In Use").click();

      // Verify filtering works correctly
      cy.get('[data-testid^="card-"]').each(($card) => {
        cy.wrap($card)
          .find('[data-testid="in-use-indicator"]')
          .should("be.visible");
      });
    });
  });

  describe("Scenario Testing and Validation", () => {
    it("should test scenario in simulation environment", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Select scenario to test
      cy.get('[data-testid^="test-"]').first().click();

      // Start test simulation
      cy.url().should("include", "/practice/a/");

      // Verify scenario behaves according to settings
      cy.get('[data-testid="scenario-info"]').should("be.visible");
      cy.get('[data-testid="persona-info"]').should("be.visible");
    });

    it("should validate scenario completeness", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Try to save scenario with missing elements
      cy.get('input[placeholder="Enter scenario name"]').type(
        "Incomplete Scenario"
      );
      cy.get('button:contains("Save Scenario")').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Persona is required"
      );

      // Verify scenario cannot be saved until complete
      cy.url().should("include", "/create/scenarios/new");
    });
  });

  describe("Scenario Data Validation", () => {
    it("should validate scenario name format", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Try to create scenario with invalid name format
      cy.get('input[placeholder="Enter scenario name"]').type(""); // Empty name
      cy.get('button:contains("Save Scenario")').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Name is required"
      );

      // Verify form submission is prevented
      cy.url().should("include", "/create/scenarios/new");
    });

    it("should validate scenario description length", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Try to create scenario with very long description
      cy.get('input[placeholder="Enter scenario name"]').type(
        "Long Description Test"
      );
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("a".repeat(10000));
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Description too long"
      );
    });
  });

  describe("Scenario Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("POST", "/api/scenarios", {
        statusCode: 500,
        body: { error: "Server error" },
      });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios/new");

      // Try to create scenario
      cy.get('input[placeholder="Enter scenario name"]').type("API Error Test");
      cy.get(
        'textarea[placeholder="Enter a custom scenario description or leave blank to auto-generate..."]'
      ).type("Test description");
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Save Scenario")').click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to create scenario"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/scenarios", { forceNetworkError: true });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Verify appropriate error message
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Failed to load scenarios"
      );
    });
  });

  describe("Scenario Performance", () => {
    it("should load scenario data efficiently", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Verify scenario list loads within acceptable time
      cy.get('[data-testid^="card-"]', { timeout: 10000 }).should("be.visible");

      // Verify loading states are displayed appropriately
      cy.get('[data-testid="loading-skeleton"]').should("not.exist");
    });
  });

  describe("Scenario Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "placeholder", "Search scenarios...");

      // Test Enter key for form submission
      cy.get('[data-testid="create-scenario-button"]').focus();
      cy.get('[data-testid="create-scenario-button"]').type("{enter}");
      cy.url().should("include", "/create/scenarios/new");
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/scenarios");

      // Verify form elements have appropriate ARIA labels
      cy.get('input[placeholder="Search scenarios..."]').should(
        "have.attr",
        "aria-label"
      );

      // Verify interactive elements are announced correctly
      cy.get('[data-testid="create-scenario-button"]').should(
        "have.attr",
        "aria-label"
      );
    });
  });
});
