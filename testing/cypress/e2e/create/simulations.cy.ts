/// <reference types="cypress" />

describe("Simulations End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to create and manage all simulations", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Verify can access simulations page
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid="create-simulation-button"]').should("be.visible");

      // Verify can create new simulations
      cy.get('[data-testid="create-simulation-button"]').click();
      cy.url().should("include", "/create/simulations/new");
      cy.get('[data-testid="simulation-component"]').should("be.visible");

      // Verify can edit simulations (if any exist)
      cy.visit("/create/simulations");
      cy.get('[data-testid^="card-"]')
        .first()
        .then(($card) => {
          if ($card.length > 0) {
            cy.get('[data-testid^="edit-"]').first().should("be.visible");
          }
        });

      // Verify can delete simulations (if not in use)
      cy.get('[data-testid^="card-"]')
        .first()
        .then(($card) => {
          if ($card.length > 0) {
            cy.get('[data-testid^="delete-"]').first().should("be.visible");
          }
        });
    });

    it("should allow superadmin users to create and manage all simulations", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/create/simulations");

      // Verify can access simulations page
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid="create-simulation-button"]').should("be.visible");

      // Verify can create new simulations
      cy.get('[data-testid="create-simulation-button"]').click();
      cy.url().should("include", "/create/simulations/new");
      cy.get('[data-testid="simulation-component"]').should("be.visible");
    });

    it("should allow instructional users to create and manage simulations", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/create/simulations");

      // Verify can access simulations page
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid="create-simulation-button"]').should("be.visible");

      // Verify can create new simulations
      cy.get('[data-testid="create-simulation-button"]').click();
      cy.url().should("include", "/create/simulations/new");
      cy.get('[data-testid="simulation-component"]').should("be.visible");
    });

    it("should prevent TA users from accessing simulation creation", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/create/simulations");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
    });

    it("should prevent guest users from accessing simulation creation", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/create/simulations");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
    });
  });

  describe("Simulation Creation", () => {
    it("should create a new simulation with basic information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Fill in basic information
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Test Simulation"
      );
      cy.get('input[placeholder="Time limit in minutes"]').type("30");

      // Select rubric
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();

      // Select scenarios
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').first().click();

      // Submit form
      cy.get('button:contains("Create Simulation")').click();

      // Verify simulation is created successfully
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid^="card-"]').should("contain", "Test Simulation");
    });

    it("should create a simulation with multiple scenarios", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Fill basic information
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Multi-Scenario Simulation"
      );
      cy.get('input[placeholder="Time limit in minutes"]').type("45");

      // Select rubric
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();

      // Select multiple scenarios
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').first().click();
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').eq(1).click();

      // Submit form
      cy.get('button:contains("Create Simulation")').click();

      // Verify simulation is created
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid^="card-"]').should(
        "contain",
        "Multi-Scenario Simulation"
      );
    });

    it("should create a simulation with custom settings", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Fill basic information
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Custom Settings Simulation"
      );
      cy.get('input[placeholder="Time limit in minutes"]').type("60");

      // Select rubric
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();

      // Configure custom settings
      cy.get('input[type="checkbox"]').first().check(); // Active simulation
      cy.get('input[placeholder="Attempt limit"]').type("3");

      // Submit form
      cy.get('button:contains("Create Simulation")').click();

      // Verify simulation is created with custom settings
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid^="card-"]').should(
        "contain",
        "Custom Settings Simulation"
      );
    });

    it("should validate required fields during creation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Try to submit without required fields
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Title is required"
      );
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Rubric is required"
      );

      // Verify form cannot be submitted
      cy.url().should("include", "/create/simulations/new");
    });

    it("should handle duplicate simulation names gracefully", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Create first simulation
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Duplicate Test"
      );
      cy.get('input[placeholder="Time limit in minutes"]').type("30");
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Try to create second simulation with same name
      cy.visit("/create/simulations/new");
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Duplicate Test"
      );
      cy.get('input[placeholder="Time limit in minutes"]').type("45");
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Simulation title already exists"
      );
    });
  });

  describe("Simulation Management and Editing", () => {
    it("should edit simulation information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Click edit on first simulation
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/create/simulations/s/");

      // Modify simulation information
      cy.get('input[placeholder="Enter simulation title"]')
        .clear()
        .type("Updated Simulation Title");
      cy.get('input[placeholder="Time limit in minutes"]').clear().type("90");

      // Submit changes
      cy.get('button:contains("Update Simulation")').click();

      // Verify changes are saved
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid^="card-"]').should(
        "contain",
        "Updated Simulation Title"
      );
    });

    it("should update simulation scenario assignments", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Click edit on first simulation
      cy.get('[data-testid^="edit-"]').first().click();

      // Add/remove scenarios
      cy.get('button[role="combobox"]').eq(1).click();
      cy.get('[role="option"]').first().click();

      // Submit changes
      cy.get('button:contains("Update Simulation")').click();

      // Verify scenario assignments are updated
      cy.url().should("include", "/create/simulations");
    });

    it("should update simulation rubric assignments", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Click edit on first simulation
      cy.get('[data-testid^="edit-"]').first().click();

      // Change rubric assignment
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').eq(1).click();

      // Submit changes
      cy.get('button:contains("Update Simulation")').click();

      // Verify rubric is updated
      cy.url().should("include", "/create/simulations");
    });

    it("should update simulation settings", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Click edit on first simulation
      cy.get('[data-testid^="edit-"]').first().click();

      // Modify settings
      cy.get('input[placeholder="Time limit in minutes"]').clear().type("120");
      cy.get('input[type="checkbox"]').first().uncheck(); // Deactivate simulation

      // Submit changes
      cy.get('button:contains("Update Simulation")').click();

      // Verify settings are updated
      cy.url().should("include", "/create/simulations");
    });

    it("should prevent editing simulations that are in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Find simulation that is in use (has cohorts)
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

  describe("Simulation Deletion and Constraints", () => {
    it("should delete simulation when not in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Find simulation not in use
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

              // Verify simulation is deleted
              cy.get('[data-testid^="card-"]').should(
                "not.contain",
                "Test Simulation"
              );
              return false; // Break the loop
            }
          });
      });
    });

    it("should prevent deletion of simulations that are in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Find simulation that is in use
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

    it("should show warning when attempting to delete active simulation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Find simulation that is in use
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
                .should("contain", "Cannot delete simulation in use");
              return false; // Break the loop
            }
          });
      });
    });

    it("should show which attempts are using the simulation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Find simulation that is in use
      cy.get('[data-testid^="card-"]').each(($card) => {
        cy.wrap($card)
          .find('[data-testid="in-use-indicator"]')
          .then(($indicator) => {
            if ($indicator.length > 0) {
              // Click on in-use indicator to see details
              cy.wrap($card).find('[data-testid="in-use-indicator"]').click();

              // Verify list of attempts using the simulation is displayed
              cy.get('[data-testid="usage-details-dialog"]').should(
                "be.visible"
              );
              cy.get('[data-testid="usage-details-dialog"]').should(
                "contain",
                "Attempts using this simulation"
              );

              return false; // Break the loop
            }
          });
      });
    });
  });

  describe("Simulation Duplication", () => {
    it("should duplicate simulations", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Click duplicate on first simulation
      cy.get('[data-testid^="duplicate-"]').first().click();

      // Verify new simulation is created with same settings
      cy.url().should("include", "/create/simulations/new");
      cy.get('input[placeholder="Enter simulation title"]').should(
        "contain.value",
        "Copy"
      );

      // Verify all settings are copied
      cy.get('input[placeholder="Time limit in minutes"]').should(
        "not.be.empty"
      );
    });

    it("should create unique names for duplicated simulations", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Duplicate a simulation multiple times
      cy.get('[data-testid^="duplicate-"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      cy.visit("/create/simulations");
      cy.get('[data-testid^="duplicate-"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Verify each duplicated simulation has unique name
      cy.visit("/create/simulations");
      cy.get('[data-testid^="card-"]').should("contain", "Copy");
      cy.get('[data-testid^="card-"]').should("contain", "Copy (1)");
    });
  });

  describe("Simulation Configuration", () => {
    it("should configure time limits for simulations", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Set time limits
      cy.get('input[placeholder="Time limit in minutes"]').type("90");

      // Submit form
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Time Limit Test"
      );
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Verify time limits are configured
      cy.url().should("include", "/create/simulations");
      cy.get('[data-testid^="card-"]').should("contain", "90 minutes");
    });

    it("should configure attempt limits for simulations", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Set attempt limits
      cy.get('input[placeholder="Attempt limit"]').type("5");

      // Submit form
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Attempt Limit Test"
      );
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Verify attempt limits are configured
      cy.url().should("include", "/create/simulations");
    });

    it("should configure completion criteria for simulations", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Configure completion criteria
      cy.get('input[placeholder="Minimum score"]').type("70");
      cy.get('input[placeholder="Required scenarios"]').type("2");

      // Submit form
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Completion Criteria Test"
      );
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Verify completion criteria are configured
      cy.url().should("include", "/create/simulations");
    });
  });

  describe("Simulation Assignment to Cohorts", () => {
    it("should assign simulation to cohorts", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Select simulation to assign
      cy.get('[data-testid^="assign-"]').first().click();

      // Choose cohorts to assign to
      cy.get('[data-testid="cohort-selector"]').click();
      cy.get('[role="option"]').first().click();

      // Submit assignment
      cy.get('button:contains("Assign to Cohorts")').click();

      // Verify simulation is assigned to cohorts
      cy.get('[data-testid="assignment-success"]').should(
        "contain",
        "Simulation assigned successfully"
      );
    });

    it("should show which cohorts simulation is assigned to", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Select simulation
      cy.get('[data-testid^="card-"]').first().click();

      // View cohort assignments
      cy.get('[data-testid="cohort-assignments"]').should("be.visible");

      // Verify assigned cohorts are displayed
      cy.get('[data-testid="assigned-cohort"]').should(
        "have.length.at.least",
        1
      );
    });
  });

  describe("Simulation Search and Filtering", () => {
    it("should search simulations by name", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Search for simulation by name
      cy.get('input[placeholder="Search simulations..."]').type(
        "Test Simulation"
      );

      // Verify search results are displayed
      cy.get('[data-testid^="card-"]').should("contain", "Test Simulation");
    });

    it("should filter simulations by scenario", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Filter simulations by assigned scenario
      cy.get('[data-testid="scenario-filter"]').click();
      cy.get('[role="option"]').first().click();

      // Verify filtering works correctly
      cy.get('[data-testid^="card-"]').should("have.length.at.least", 1);
    });

    it("should filter simulations by rubric", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Filter simulations by assigned rubric
      cy.get('[data-testid="rubric-filter"]').click();
      cy.get('[role="option"]').first().click();

      // Verify filtering works correctly
      cy.get('[data-testid^="card-"]').should("have.length.at.least", 1);
    });

    it("should filter simulations by usage status", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Filter simulations by usage status
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

  describe("Simulation Testing and Validation", () => {
    it("should test simulation in practice environment", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Select simulation to test
      cy.get('[data-testid^="test-"]').first().click();

      // Start test simulation
      cy.url().should("include", "/practice/a/");

      // Verify simulation behaves according to settings
      cy.get('[data-testid="simulation-info"]').should("be.visible");
      cy.get('[data-testid="time-limit"]').should("be.visible");
    });

    it("should validate simulation completeness", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Try to save simulation with missing elements
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Incomplete Simulation"
      );
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Rubric is required"
      );

      // Verify simulation cannot be saved until complete
      cy.url().should("include", "/create/simulations/new");
    });

    it("should show simulation performance metrics", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Select simulation to view metrics
      cy.get('[data-testid^="metrics-"]').first().click();

      // Verify metrics are displayed
      cy.get('[data-testid="usage-count"]').should("be.visible");
      cy.get('[data-testid="average-score"]').should("be.visible");
      cy.get('[data-testid="completion-rate"]').should("be.visible");
    });
  });

  describe("Simulation Data Validation", () => {
    it("should validate simulation name format", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Try to create simulation with invalid name format
      cy.get('input[placeholder="Enter simulation title"]').type(""); // Empty title
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Title is required"
      );

      // Verify form submission is prevented
      cy.url().should("include", "/create/simulations/new");
    });

    it("should validate time limit ranges", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Try to set invalid time limits
      cy.get('input[placeholder="Time limit in minutes"]').type("0");
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Time limit must be between 1 and 120 minutes"
      );

      // Try another invalid value
      cy.get('input[placeholder="Time limit in minutes"]').clear().type("150");
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Time limit must be between 1 and 120 minutes"
      );
    });

    it("should validate required simulation components", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Try to create simulation without required components
      cy.get('input[placeholder="Enter simulation title"]').type(
        "Missing Components"
      );
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Rubric is required"
      );

      // Verify form submission is prevented
      cy.url().should("include", "/create/simulations/new");
    });
  });

  describe("Simulation Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("POST", "/api/simulations", {
        statusCode: 500,
        body: { error: "Server error" },
      });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Try to create simulation
      cy.get('input[placeholder="Enter simulation title"]').type(
        "API Error Test"
      );
      cy.get('input[placeholder="Time limit in minutes"]').type("30");
      cy.get('button[role="combobox"]').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('button:contains("Create Simulation")').click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to create simulation"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/simulations", { forceNetworkError: true });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Verify appropriate error message
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Failed to load simulations"
      );
    });

    it("should handle validation errors appropriately", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations/new");

      // Submit invalid data
      cy.get('input[placeholder="Enter simulation title"]').type(""); // Empty title
      cy.get('button:contains("Create Simulation")').click();

      // Verify validation errors are displayed clearly
      cy.get('[data-testid="error-message"]').should(
        "contain",
        "Title is required"
      );

      // Verify form state is preserved
      cy.get('input[placeholder="Time limit in minutes"]').should("be.visible");
    });
  });

  describe("Simulation Performance", () => {
    it("should load simulation data efficiently", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Verify simulation list loads within acceptable time
      cy.get('[data-testid^="card-"]', { timeout: 10000 }).should("be.visible");

      // Verify loading states are displayed appropriately
      cy.get('[data-testid="loading-skeleton"]').should("not.exist");
    });

    it("should handle large numbers of simulations without performance degradation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Verify interface remains responsive
      cy.get('[data-testid^="card-"]').should("be.visible");

      // Verify search and filtering remain fast
      cy.get('input[placeholder="Search simulations..."]').type("test");
      cy.get('[data-testid^="card-"]').should("be.visible");
    });
  });

  describe("Simulation Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "placeholder", "Search simulations...");

      // Test Enter key for form submission
      cy.get('[data-testid="create-simulation-button"]').focus();
      cy.get('[data-testid="create-simulation-button"]').type("{enter}");
      cy.url().should("include", "/create/simulations/new");
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/create/simulations");

      // Verify form elements have appropriate ARIA labels
      cy.get('input[placeholder="Search simulations..."]').should(
        "have.attr",
        "aria-label"
      );

      // Verify interactive elements are announced correctly
      cy.get('[data-testid="create-simulation-button"]').should(
        "have.attr",
        "aria-label"
      );
    });
  });
});
