/// <reference types="cypress" />

describe("Staff End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it.skip("should allow admin users to create and manage all staff", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Verify can access staff management page
      cy.url().should("include", "/management/staff");

      // Verify staff summary cards are visible
      cy.get('[data-testid="staff-summary-card-active"]').should("be.visible");
      cy.get('[data-testid="staff-summary-card-admin"]').should("be.visible");
      cy.get('[data-testid="staff-summary-card-instructional"]').should(
        "be.visible"
      );
      cy.get('[data-testid="staff-summary-card-ta"]').should("be.visible");

      // Verify can create new staff (button should be visible)
      cy.get('[data-testid="create-staff-button"]').should("be.visible");

      // Verify staff data table is visible
      cy.get('[data-testid="staff-data-table"]').should("be.visible");
    });

    it.skip("should allow superadmin users to create and manage all staff", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/management/staff");

      // Verify can access staff management page
      cy.url().should("include", "/management/staff");

      // Verify staff summary cards are visible
      cy.get('[data-testid="staff-summary-card-active"]').should("be.visible");
      cy.get('[data-testid="staff-summary-card-admin"]').should("be.visible");
      cy.get('[data-testid="staff-summary-card-instructional"]').should(
        "be.visible"
      );
      cy.get('[data-testid="staff-summary-card-ta"]').should("be.visible");

      // Verify can create new staff
      cy.get('[data-testid="create-staff-button"]').should("be.visible");

      // Verify staff data table is visible
      cy.get('[data-testid="staff-data-table"]').should("be.visible");
    });

    it.skip("should prevent instructional users from accessing staff management", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/management/staff");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
      cy.get('[data-testid="access-denied-message"]').should(
        "contain",
        "Access Denied"
      );
    });

    it.skip("should prevent TA users from accessing staff management", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/management/staff");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
      cy.get('[data-testid="access-denied-message"]').should(
        "contain",
        "Access Denied"
      );
    });

    it.skip("should prevent guest users from accessing staff management", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/management/staff");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
      cy.get('[data-testid="access-denied-message"]').should(
        "contain",
        "Access Denied"
      );
    });
  });

  describe("Staff Creation", () => {
    it.skip("should create staff member manually", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click create new staff button
      cy.get('[data-testid="create-staff-button"]').click();
      cy.url().should("include", "/management/staff/new");

      // Fill in staff information
      cy.get('[data-testid="staff-first-name-input"]').type("John");
      cy.get('[data-testid="staff-last-name-input"]').type("Doe");
      cy.get('[data-testid="staff-alias-input"]').type("jdoe");
      cy.get('[data-testid="staff-role-select"]').click();
      cy.get('[data-testid="staff-role-option-ta"]').click();

      // Submit form
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify redirect back to staff list
      cy.url().should("include", "/management/staff");

      // Verify success message
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Staff member created successfully"
      );
    });

    it.skip("should create staff members via CSV upload", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Switch to CSV tab
      cy.get('[data-testid="csv-upload-tab"]').click();

      // Upload CSV file
      cy.get('[data-testid="csv-file-input"]').attachFile("staff-import.csv");

      // Verify CSV preview is displayed
      cy.get('[data-testid="csv-preview-table"]').should("be.visible");

      // Submit CSV import
      cy.get('[data-testid="csv-submit-button"]').click();

      // Verify redirect back to staff list
      cy.url().should("include", "/management/staff");

      // Verify success message
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Staff members imported successfully"
      );
    });

    it.skip("should validate required fields during creation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Try to submit form without required fields
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="first-name-error"]').should(
        "contain",
        "First name is required"
      );
      cy.get('[data-testid="last-name-error"]').should(
        "contain",
        "Last name is required"
      );
      cy.get('[data-testid="alias-error"]').should(
        "contain",
        "Alias is required"
      );
      cy.get('[data-testid="role-error"]').should(
        "contain",
        "Role is required"
      );

      // Verify form cannot be submitted
      cy.url().should("include", "/management/staff/new");
    });

    it.skip("should handle duplicate email addresses gracefully", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Fill in form with existing alias
      cy.get('[data-testid="staff-first-name-input"]').type("Jane");
      cy.get('[data-testid="staff-last-name-input"]').type("Smith");
      cy.get('[data-testid="staff-alias-input"]').type("existing-alias");
      cy.get('[data-testid="staff-role-select"]').click();
      cy.get('[data-testid="staff-role-option-ta"]').click();

      // Submit form
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Alias already exists"
      );
    });

    it.skip("should validate email format during creation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Try to create staff with invalid alias format
      cy.get('[data-testid="staff-alias-input"]').type("invalid@alias");

      // Verify validation error is displayed
      cy.get('[data-testid="alias-error"]').should(
        "contain",
        "Invalid alias format"
      );
    });
  });

  describe("Staff Management and Editing", () => {
    it.skip("should edit staff member information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click edit button on first staff member
      cy.get('[data-testid="staff-edit-button"]').first().click();
      cy.url().should("include", "/management/staff/p/");

      // Modify staff information
      cy.get('[data-testid="staff-first-name-input"]').clear().type("Updated");
      cy.get('[data-testid="staff-last-name-input"]').clear().type("Name");

      // Submit changes
      cy.get('[data-testid="update-staff-submit-button"]').click();

      // Verify changes are saved
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Staff member updated successfully"
      );
    });

    it.skip("should update staff member role", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click edit button on first staff member
      cy.get('[data-testid="staff-edit-button"]').first().click();

      // Change staff member role
      cy.get('[data-testid="staff-role-select"]').click();
      cy.get('[data-testid="staff-role-option-instructional"]').click();

      // Submit changes
      cy.get('[data-testid="update-staff-submit-button"]').click();

      // Verify role is updated
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Staff member updated successfully"
      );
    });

    it.skip("should validate changes during editing", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click edit button on first staff member
      cy.get('[data-testid="staff-edit-button"]').first().click();

      // Try to edit with invalid information
      cy.get('[data-testid="staff-first-name-input"]').clear();

      // Submit changes
      cy.get('[data-testid="update-staff-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="first-name-error"]').should(
        "contain",
        "First name is required"
      );
    });
  });

  describe("Staff Deletion", () => {
    it.skip("should delete staff member", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click edit button on first staff member
      cy.get('[data-testid="staff-edit-button"]').first().click();

      // Click delete button
      cy.get('[data-testid="delete-staff-button"]').click();

      // Confirm deletion in dialog
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="confirm-delete-button"]').click();

      // Verify staff member is deleted
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Staff member deleted successfully"
      );
    });

    it.skip("should show confirmation dialog before deletion", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click edit button on first staff member
      cy.get('[data-testid="staff-edit-button"]').first().click();

      // Click delete button
      cy.get('[data-testid="delete-staff-button"]').click();

      // Verify confirmation dialog is displayed
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="delete-confirmation-message"]').should(
        "contain",
        "Are you sure"
      );

      // Cancel deletion
      cy.get('[data-testid="cancel-delete-button"]').click();
      cy.get('[data-testid="delete-confirmation-dialog"]').should(
        "not.be.visible"
      );
    });
  });

  describe("Staff Activity Tracking", () => {
    it.skip("should display staff activity information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Verify activity information is displayed in data table
      cy.get('[data-testid="staff-data-table"]').should("be.visible");
      cy.get('[data-testid="staff-last-active-column"]').should("be.visible");
      cy.get('[data-testid="staff-status-column"]').should("be.visible");
    });

    it.skip("should filter staff by activity status", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click on active staff card
      cy.get('[data-testid="staff-summary-card-active"]').click();

      // Verify filter dialog opens
      cy.get('[data-testid="staff-filter-dialog"]').should("be.visible");
      cy.get('[data-testid="staff-filter-dialog-title"]').should(
        "contain",
        "Active Staff Members"
      );

      // Close dialog
      cy.get('[data-testid="close-filter-dialog"]').click();
    });

    it.skip("should filter staff by role", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Click on TA staff card
      cy.get('[data-testid="staff-summary-card-ta"]').click();

      // Verify filter dialog opens with TA staff
      cy.get('[data-testid="staff-filter-dialog"]').should("be.visible");
      cy.get('[data-testid="staff-filter-dialog-title"]').should(
        "contain",
        "Teaching Assistants"
      );
    });
  });

  describe("Staff Data Validation", () => {
    it.skip("should validate staff name uniqueness", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Try to create staff with duplicate name
      cy.get('[data-testid="staff-first-name-input"]').type("Existing");
      cy.get('[data-testid="staff-last-name-input"]').type("Name");
      cy.get('[data-testid="staff-alias-input"]').type("existing-alias");
      cy.get('[data-testid="staff-role-select"]').click();
      cy.get('[data-testid="staff-role-option-ta"]').click();

      // Submit form
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Staff member already exists"
      );
    });

    it.skip("should validate required fields", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Try to submit form with missing required fields
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="first-name-error"]').should(
        "contain",
        "First name is required"
      );
      cy.get('[data-testid="last-name-error"]').should(
        "contain",
        "Last name is required"
      );
      cy.get('[data-testid="alias-error"]').should(
        "contain",
        "Alias is required"
      );
      cy.get('[data-testid="role-error"]').should(
        "contain",
        "Role is required"
      );
    });
  });

  describe("Staff Error Handling", () => {
    it.skip("should handle API errors gracefully", () => {
      // Simulate API error by intercepting the request
      cy.intercept("POST", "/api/profiles", {
        statusCode: 500,
        body: { error: "Server error" },
      });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Fill in form
      cy.get('[data-testid="staff-first-name-input"]').type("Test");
      cy.get('[data-testid="staff-last-name-input"]').type("User");
      cy.get('[data-testid="staff-alias-input"]').type("testuser");
      cy.get('[data-testid="staff-role-select"]').click();
      cy.get('[data-testid="staff-role-option-ta"]').click();

      // Submit form
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to create staff member"
      );
    });

    it.skip("should handle validation errors appropriately", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff/new");

      // Submit invalid data
      cy.get('[data-testid="staff-alias-input"]').type("invalid@alias");

      // Submit form
      cy.get('[data-testid="create-staff-submit-button"]').click();

      // Verify validation errors are displayed clearly
      cy.get('[data-testid="alias-error"]').should(
        "contain",
        "Invalid alias format"
      );
    });
  });

  describe("Staff Performance", () => {
    it.skip("should load staff data efficiently", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Verify staff list loads within acceptable time
      cy.get('[data-testid="staff-data-table"]').should("be.visible");
      cy.get('[data-testid="staff-loading-skeleton"]').should("not.exist");
    });

    it.skip("should handle large numbers of staff without performance degradation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Verify interface remains responsive with many staff members
      cy.get('[data-testid="staff-data-table"]').should("be.visible");
      cy.get('[data-testid="staff-search-input"]').should("be.enabled");
      cy.get('[data-testid="staff-filter-button"]').should("be.enabled");
    });
  });

  describe("Staff Accessibility", () => {
    it.skip("should support keyboard navigation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "data-testid", "staff-search-input");

      // Test Enter key for form submission
      cy.get('[data-testid="staff-search-input"]').type("test{enter}");
      cy.get('[data-testid="staff-data-table"]').should("be.visible");
    });

    it.skip("should provide appropriate ARIA labels", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/staff");

      // Verify form elements have appropriate ARIA labels
      cy.get('[data-testid="staff-search-input"]').should(
        "have.attr",
        "aria-label"
      );
      cy.get('[data-testid="staff-filter-button"]').should(
        "have.attr",
        "aria-label"
      );

      // Verify table elements are accessible
      cy.get('[data-testid="staff-data-table"]').should(
        "have.attr",
        "role",
        "table"
      );
    });
  });
});
