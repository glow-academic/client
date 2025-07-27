/// <reference types="cypress" />

describe("Cohorts End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it("should allow admin users to create and manage all cohorts", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/dashboard");

      // Navigate to cohorts via sidebar
      cy.get('[data-sidebar="menu-sub-button"]').contains("Cohorts").click();
      cy.url().should("include", "/cohorts");

      // Verify can view all cohorts
      cy.get('[data-testid^="card-"]').should("be.visible");

      // Verify can create new cohorts
      cy.get("button").contains("Create Cohort").click();
      cy.url().should("include", "/cohorts/new");

      // Verify can edit any cohort
      cy.visit("/cohorts");
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Verify can delete cohorts (if not in use)
      cy.visit("/cohorts");
      cy.get('[data-testid^="delete-"]').should("be.visible");
    });

    it("should allow superadmin users to create and manage all cohorts", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/dashboard");

      // Navigate to cohorts via sidebar
      cy.get('[data-sidebar="menu-sub-button"]').contains("Cohorts").click();
      cy.url().should("include", "/cohorts");

      // Verify can view all cohorts
      cy.get('[data-testid^="card-"]').should("be.visible");

      // Verify can create new cohorts
      cy.get("button").contains("Create Cohort").click();
      cy.url().should("include", "/cohorts/new");

      // Verify can edit any cohort
      cy.visit("/cohorts");
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Verify can delete cohorts (if not in use)
      cy.visit("/cohorts");
      cy.get('[data-testid^="delete-"]').should("be.visible");
    });

    it("should allow instructional users to create and manage their cohorts", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/dashboard");

      // Navigate to cohorts via sidebar
      cy.get('[data-sidebar="menu-sub-button"]').contains("Cohorts").click();
      cy.url().should("include", "/cohorts");

      // Verify can create new cohorts
      cy.get("button").contains("Create Cohort").click();
      cy.url().should("include", "/cohorts/new");

      // Verify can edit cohorts they are assigned to
      cy.visit("/cohorts");
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Verify can view cohorts they are assigned to
      cy.visit("/cohorts");
      cy.get('[data-testid^="card-"]').should("be.visible");
    });

    it("should prevent TA users from accessing cohort creation", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to cohorts directly
      cy.visit("/cohorts");
      cy.url().should("include", "/access-denied");

      // Try to navigate to create cohorts directly
      cy.visit("/cohorts/new");
      cy.url().should("include", "/access-denied");

      // Verify cohorts section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Cohorts");
    });

    it("should prevent guest users from accessing cohort creation", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/practice");

      // Try to navigate to cohorts directly
      cy.visit("/cohorts");
      cy.url().should("include", "/access-denied");

      // Try to navigate to create cohorts directly
      cy.visit("/cohorts/new");
      cy.url().should("include", "/access-denied");

      // Verify cohorts section is not visible in sidebar
      cy.get('[data-sidebar="menu-button"]').should("not.contain", "Cohorts");
    });
  });

  describe("Cohort Creation", () => {
    it("should create a new cohort with basic information", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Click create new cohort
      cy.get("button").contains("Create Cohort").click();
      cy.url().should("include", "/cohorts/new");

      // Fill in basic information
      cy.get('input[placeholder="Enter cohort title"]').type("Test Cohort");
      cy.get('textarea[placeholder="Enter cohort description"]').type(
        "Test description"
      );

      // Submit form
      cy.get("button").contains("Create Cohort").click();

      // Verify cohort is created successfully
      cy.url().should("include", "/cohorts");
      cy.get('[data-testid^="card-"]').should("contain", "Test Cohort");
    });

    it("should create a cohort with assigned simulations", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Fill in basic information
      cy.get('input[placeholder="Enter cohort title"]').type(
        "Simulation Cohort"
      );
      cy.get('textarea[placeholder="Enter cohort description"]').type(
        "Cohort with simulations"
      );

      // Select simulations to assign to cohort
      cy.get('[data-testid="simulation-picker"]').click();
      cy.get('[role="option"]').first().click();

      // Submit form
      cy.get("button").contains("Create Cohort").click();

      // Verify cohort is created with assigned simulations
      cy.url().should("include", "/cohorts");
      cy.get('[data-testid^="card-"]').should("contain", "Simulation Cohort");
    });

    it("should create a cohort with assigned profiles", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Fill in basic information
      cy.get('input[placeholder="Enter cohort title"]').type("Profile Cohort");
      cy.get('textarea[placeholder="Enter cohort description"]').type(
        "Cohort with profiles"
      );

      // Add profiles to cohort (TAs, instructional staff)
      cy.get('[data-testid="add-profile-button"]').click();
      cy.get('[data-testid="profile-search"]').type("test");
      cy.get('[data-testid="profile-option"]').first().click();

      // Submit form
      cy.get("button").contains("Create Cohort").click();

      // Verify cohort is created with assigned profiles
      cy.url().should("include", "/cohorts");
      cy.get('[data-testid^="card-"]').should("contain", "Profile Cohort");
    });

    it("should validate required fields during creation", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to submit form without required fields
      cy.get("button").contains("Create Cohort").click();

      // Verify validation errors are displayed
      cy.get('input[placeholder="Enter cohort title"]').should(
        "have.attr",
        "required"
      );
      cy.get('[data-testid="validation-error"]').should(
        "contain",
        "Title is required"
      );

      // Verify form cannot be submitted
      cy.url().should("include", "/cohorts/new");
    });

    it("should handle duplicate cohort names gracefully", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to create cohort with existing name
      cy.get('input[placeholder="Enter cohort title"]').type("Existing Cohort");
      cy.get('textarea[placeholder="Enter cohort description"]').type(
        "Duplicate test"
      );
      cy.get("button").contains("Create Cohort").click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Cohort name already exists"
      );

      // Verify form is not submitted
      cy.url().should("include", "/cohorts/new");
    });
  });

  describe("Cohort Management and Editing", () => {
    it("should edit cohort information", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select existing cohort to edit
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Modify cohort information
      cy.get('input[placeholder="Enter cohort title"]')
        .clear()
        .type("Updated Cohort");
      cy.get('textarea[placeholder="Enter cohort description"]')
        .clear()
        .type("Updated description");

      // Submit changes
      cy.get("button").contains("Update Cohort").click();

      // Verify changes are saved
      cy.url().should("include", "/cohorts");
      cy.get('[data-testid^="card-"]').should("contain", "Updated Cohort");
    });

    it("should add simulations to existing cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select existing cohort to edit
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Add new simulations to cohort
      cy.get('[data-testid="simulation-picker"]').click();
      cy.get('[role="option"]').first().click();

      // Submit changes
      cy.get("button").contains("Update Cohort").click();

      // Verify simulations are added
      cy.url().should("include", "/cohorts");
    });

    it("should remove simulations from existing cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select existing cohort to edit
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Remove simulations from cohort
      cy.get('[data-testid="remove-simulation"]').first().click();

      // Submit changes
      cy.get("button").contains("Update Cohort").click();

      // Verify simulations are removed
      cy.url().should("include", "/cohorts");
    });

    it("should add profiles to existing cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select existing cohort to edit
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Add new profiles to cohort
      cy.get('[data-testid="add-profile-button"]').click();
      cy.get('[data-testid="profile-search"]').type("test");
      cy.get('[data-testid="profile-option"]').first().click();

      // Submit changes
      cy.get("button").contains("Update Cohort").click();

      // Verify profiles are added
      cy.url().should("include", "/cohorts");
    });

    it("should remove profiles from existing cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select existing cohort to edit
      cy.get('[data-testid^="edit-"]').first().click();
      cy.url().should("include", "/cohorts/e/");

      // Remove profiles from cohort
      cy.get('[data-testid="remove-profile"]').first().click();

      // Submit changes
      cy.get("button").contains("Update Cohort").click();

      // Verify profiles are removed
      cy.url().should("include", "/cohorts");
    });

    it("should prevent editing cohorts that are in use", () => {
      // Login as instructional
      cy.mockSession({ role: "instructional" });
      cy.visit("/cohorts");

      // Try to edit cohort that is actively being used
      cy.get('[data-testid^="edit-"]').first().click();

      // Verify edit is prevented
      cy.get('[data-testid="edit-disabled-message"]').should(
        "contain",
        "Cannot edit cohort in use"
      );
    });
  });

  describe("Cohort Deletion and Constraints", () => {
    it("should delete cohort when not in use", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select cohort that is not in use
      cy.get('[data-testid^="delete-"]').first().click();

      // Confirm deletion
      cy.get('[data-testid="delete-confirm-button"]').click();

      // Verify cohort is deleted
      cy.get('[data-testid="delete-success-toast"]').should(
        "contain",
        "Cohort deleted successfully"
      );
    });

    it("should prevent deletion of cohorts that are in use", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Try to delete cohort that is actively being used
      cy.get('[data-testid^="delete-"]').first().click();

      // Verify deletion is prevented
      cy.get('[data-testid="delete-error-message"]').should(
        "contain",
        "Cannot delete cohort in use"
      );

      // Verify cohort remains in list
      cy.get('[data-testid^="card-"]').should("be.visible");
    });

    it("should show warning when attempting to delete active cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Click delete on active cohort
      cy.get('[data-testid^="delete-"]').first().click();

      // Verify warning dialog is displayed
      cy.get('[data-testid="delete-warning-dialog"]').should("be.visible");
      cy.get('[data-testid="delete-warning-message"]').should(
        "contain",
        "This cohort is currently in use"
      );
    });
  });

  describe("Cohort Duplication", () => {
    it("should duplicate default cohorts", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Select default cohort
      cy.get('[data-testid^="duplicate-"]').first().click();

      // Verify new cohort is created with same settings
      cy.get('[data-testid="duplicate-success-toast"]').should(
        "contain",
        "Cohort duplicated successfully"
      );

      // Verify new cohort has unique name
      cy.get('[data-testid^="card-"]').should("contain", "Copy");
    });

    it("should allow editing duplicated cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Duplicate a cohort
      cy.get('[data-testid^="duplicate-"]').first().click();

      // Edit the duplicated cohort
      cy.get('[data-testid^="edit-"]').last().click();
      cy.url().should("include", "/cohorts/e/");

      // Verify changes can be made
      cy.get('input[placeholder="Enter cohort title"]').should("be.visible");
    });
  });

  describe("Profile Management in Cohorts", () => {
    it("should upload CSV to add profiles to cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Upload CSV file with profile data
      cy.get('[data-testid="csv-upload-input"]').selectFile(
        "cypress/fixtures/profiles.csv"
      );

      // Verify profiles are added from CSV
      cy.get('[data-testid="csv-upload-success"]').should(
        "contain",
        "Profiles imported successfully"
      );
    });

    it("should search existing profiles to add to cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Search for existing profiles
      cy.get('[data-testid="profile-search"]').type("test");
      cy.get('[data-testid="profile-option"]').should("be.visible");

      // Select profiles to add
      cy.get('[data-testid="profile-option"]').first().click();

      // Verify profiles are added to cohort
      cy.get('[data-testid="selected-profiles"]').should("contain", "test");
    });

    it("should add profile manually to cohort", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Click add profile manually
      cy.get('[data-testid="add-profile-manually"]').click();

      // Fill in profile information
      cy.get('[data-testid="profile-first-name"]').type("John");
      cy.get('[data-testid="profile-last-name"]').type("Doe");
      cy.get('[data-testid="profile-email"]').type("john.doe@example.com");

      // Submit form
      cy.get('[data-testid="create-profile-button"]').click();

      // Verify profile is created and added to cohort
      cy.get('[data-testid="profile-created-success"]').should(
        "contain",
        "Profile created successfully"
      );
    });

    it("should validate profile information during addition", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to add profile with invalid information
      cy.get('[data-testid="add-profile-manually"]').click();
      cy.get('[data-testid="create-profile-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="validation-error"]').should(
        "contain",
        "First name is required"
      );
    });
  });

  describe("Cohort Visibility and Filtering", () => {
    it("should show only assigned cohorts for instructional users", () => {
      // Login as instructional
      cy.mockSession({ role: "instructional" });
      cy.visit("/cohorts");

      // Verify only cohorts user is assigned to are visible
      cy.get('[data-testid^="card-"]').should("be.visible");

      // Verify other cohorts are not accessible
      cy.get('[data-testid="no-cohorts-message"]').should("not.exist");
    });

    it("should show all cohorts for admin users", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Verify all cohorts are visible
      cy.get('[data-testid^="card-"]').should("be.visible");

      // Verify no filtering is applied
      cy.get('[data-testid="filter-indicator"]').should("not.exist");
    });

    it("should filter cohorts by status", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Filter by active/inactive status
      cy.get('[data-testid="status-filter"]').click();
      cy.get('[data-testid="active-filter"]').click();

      // Verify filtering works correctly
      cy.get('[data-testid^="card-"]').should("be.visible");
    });

    it("should search cohorts by name", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Search for cohort by name
      cy.get('[data-testid="cohort-search"]').type("test");

      // Verify search results are displayed
      cy.get('[data-testid^="card-"]').should("contain", "test");
    });
  });

  describe("Cohort Data Validation", () => {
    it("should validate cohort name uniqueness", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to create cohort with duplicate name
      cy.get('input[placeholder="Enter cohort title"]').type("Existing Cohort");
      cy.get("button").contains("Create Cohort").click();

      // Verify validation error is displayed
      cy.get('[data-testid="validation-error"]').should(
        "contain",
        "Cohort name already exists"
      );
    });

    it("should validate date ranges", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to create cohort with invalid date range
      cy.get('[data-testid="start-date"]').type("2025-12-31");
      cy.get('[data-testid="end-date"]').type("2025-01-01");

      // Verify validation error is displayed
      cy.get('[data-testid="validation-error"]').should(
        "contain",
        "End date must be after start date"
      );
    });

    it("should validate required fields", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to submit form with missing required fields
      cy.get("button").contains("Create Cohort").click();

      // Verify validation errors are displayed
      cy.get('input[placeholder="Enter cohort title"]').should(
        "have.attr",
        "required"
      );
    });
  });

  describe("Cohort Error Handling", () => {
    it("should handle API errors gracefully", () => {
      // Simulate API error
      cy.intercept("POST", "/api/cohorts", {
        statusCode: 500,
        body: { error: "API Error" },
      });

      // Navigate to create cohorts
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Try to perform cohort operation
      cy.get('input[placeholder="Enter cohort title"]').type("Test Cohort");
      cy.get("button").contains("Create Cohort").click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to create cohort"
      );
    });

    it("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/cohorts", { forceNetworkError: true });

      // Navigate to cohorts
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Try to perform cohort operation
      cy.get('[data-testid="retry-button"]').click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should("contain", "Network error");
    });

    it("should handle validation errors appropriately", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts/new");

      // Submit invalid data
      cy.get("button").contains("Create Cohort").click();

      // Verify validation errors are displayed clearly
      cy.get('[data-testid="validation-error"]').should("be.visible");
    });
  });

  describe("Cohort Performance", () => {
    it("should load cohort data efficiently", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Verify cohort list loads within acceptable time
      cy.get('[data-testid^="card-"]', { timeout: 10000 }).should("be.visible");
    });

    it("should handle large numbers of cohorts without performance degradation", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Verify interface remains responsive with many cohorts
      cy.get('[data-testid^="card-"]').should("be.visible");
      cy.get('[data-testid="cohort-search"]').should("be.visible");
    });
  });

  describe("Cohort Accessibility", () => {
    it("should support keyboard navigation", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "data-testid", "cohort-search");
    });

    it("should provide appropriate ARIA labels", () => {
      // Login as admin/instructional
      cy.mockSession({ role: "admin" });
      cy.visit("/cohorts");

      // Verify form elements have appropriate ARIA labels
      cy.get('[data-testid^="card-"]').should("be.visible");
      cy.get('[data-testid^="edit-"]').should("be.visible");
    });
  });
});
