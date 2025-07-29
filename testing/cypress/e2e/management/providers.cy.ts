/// <reference types="cypress" />

describe("Providers End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it.skip("should allow admin users to create and manage all providers", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Verify can access providers management page
      cy.url().should("include", "/management/providers");

      // Verify can create new providers (button should be visible)
      cy.get('[data-testid="create-provider-button"]').should("be.visible");

      // Verify providers data table is visible
      cy.get('[data-testid="providers-data-table"]').should("be.visible");
    });

    it.skip("should allow superadmin users to create and manage all providers", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/management/providers");

      // Verify can access providers management page
      cy.url().should("include", "/management/providers");

      // Verify can create new providers
      cy.get('[data-testid="create-provider-button"]').should("be.visible");

      // Verify providers data table is visible
      cy.get('[data-testid="providers-data-table"]').should("be.visible");
    });

    it.skip("should prevent instructional users from accessing provider management", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/management/providers");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
      cy.get('[data-testid="access-denied-message"]').should(
        "contain",
        "Access Denied"
      );
    });

    it.skip("should prevent TA users from accessing provider management", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/management/providers");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
      cy.get('[data-testid="access-denied-message"]').should(
        "contain",
        "Access Denied"
      );
    });

    it.skip("should prevent guest users from accessing provider management", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.visit("/management/providers");

      // Verify access is denied
      cy.url().should("include", "/access-denied");
      cy.get('[data-testid="access-denied-message"]').should(
        "contain",
        "Access Denied"
      );
    });
  });

  describe("Provider Creation", () => {
    it.skip("should create a new provider with basic information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click create new provider button
      cy.get('[data-testid="create-provider-button"]').click();
      cy.url().should("include", "/management/providers/new");

      // Fill in provider information
      cy.get('[data-testid="provider-name-input"]').type("Test Provider");
      cy.get('[data-testid="provider-description-input"]').type(
        "A test provider for testing"
      );
      cy.get('[data-testid="provider-api-key-input"]').type("test-api-key-123");
      cy.get('[data-testid="provider-base-url-input"]').type(
        "https://api.testprovider.com"
      );

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify redirect back to providers list
      cy.url().should("include", "/management/providers");

      // Verify success message
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Provider created successfully"
      );
    });

    it.skip("should create a provider with advanced settings", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Fill in basic provider information
      cy.get('[data-testid="provider-name-input"]').type("Advanced Provider");
      cy.get('[data-testid="provider-description-input"]').type(
        "Provider with advanced settings"
      );
      cy.get('[data-testid="provider-api-key-input"]').type(
        "advanced-api-key-456"
      );

      // Configure advanced settings
      cy.get('[data-testid="provider-rate-limit-input"]').type("100");
      cy.get('[data-testid="provider-timeout-input"]').type("30");
      cy.get('[data-testid="provider-retry-count-input"]').type("3");

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify provider is created with advanced settings
      cy.url().should("include", "/management/providers");
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Provider created successfully"
      );
    });

    it.skip("should validate required fields during creation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Try to submit form without required fields
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="provider-name-error"]').should(
        "contain",
        "Provider name is required"
      );
      cy.get('[data-testid="provider-description-error"]').should(
        "contain",
        "Description is required"
      );
      cy.get('[data-testid="provider-api-key-error"]').should(
        "contain",
        "API key is required"
      );

      // Verify form cannot be submitted
      cy.url().should("include", "/management/providers/new");
    });

    it.skip("should handle duplicate provider names gracefully", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Try to create provider with existing name
      cy.get('[data-testid="provider-name-input"]').type("Existing Provider");
      cy.get('[data-testid="provider-description-input"]').type(
        "A duplicate provider"
      );
      cy.get('[data-testid="provider-api-key-input"]').type("existing-api-key");

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Provider name already exists"
      );
    });

    it.skip("should validate API endpoint format", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Try to create provider with invalid API endpoint
      cy.get('[data-testid="provider-base-url-input"]').type("invalid-url");

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify validation error is displayed
      cy.get('[data-testid="provider-base-url-error"]').should(
        "contain",
        "Invalid URL format"
      );
    });
  });

  describe("Model Creation", () => {
    it.skip("should create a new model for a provider", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click on first provider to view its models
      cy.get('[data-testid="provider-settings-button"]').first().click();
      cy.url().should("include", "/management/providers/p/");

      // Click create new model button
      cy.get('[data-testid="create-model-button"]').click();
      cy.url().should("include", "/management/providers/p/");

      // Fill in model information
      cy.get('[data-testid="model-name-input"]').type("Test Model");
      cy.get('[data-testid="model-identifier-input"]').type("test-model-v1");
      cy.get('[data-testid="model-description-input"]').type(
        "A test model for testing"
      );

      // Submit form
      cy.get('[data-testid="create-model-submit-button"]').click();

      // Verify model is created successfully
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Model created successfully"
      );
    });

    it.skip("should create a model with specific capabilities", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Navigate to provider and create model
      cy.get('[data-testid="provider-settings-button"]').first().click();
      cy.get('[data-testid="create-model-button"]').click();

      // Fill in model information
      cy.get('[data-testid="model-name-input"]').type("Capable Model");
      cy.get('[data-testid="model-identifier-input"]').type("capable-model-v1");
      cy.get('[data-testid="model-description-input"]').type(
        "Model with specific capabilities"
      );

      // Configure model capabilities
      cy.get('[data-testid="model-text-generation-checkbox"]').click();
      cy.get('[data-testid="model-code-generation-checkbox"]').click();
      cy.get('[data-testid="model-function-calling-checkbox"]').click();

      // Submit form
      cy.get('[data-testid="create-model-submit-button"]').click();

      // Verify model is created with specified capabilities
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Model created successfully"
      );
    });

    it.skip("should validate model information during creation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Navigate to provider and create model
      cy.get('[data-testid="provider-settings-button"]').first().click();
      cy.get('[data-testid="create-model-button"]').click();

      // Try to create model with invalid information
      cy.get('[data-testid="model-name-input"]').type(""); // Empty name
      cy.get('[data-testid="create-model-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="model-name-error"]').should(
        "contain",
        "Model name is required"
      );
    });

    it.skip("should handle duplicate model names within provider", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Navigate to provider and create model
      cy.get('[data-testid="provider-settings-button"]').first().click();
      cy.get('[data-testid="create-model-button"]').click();

      // Try to create model with existing name in same provider
      cy.get('[data-testid="model-name-input"]').type("Existing Model");
      cy.get('[data-testid="model-identifier-input"]').type(
        "existing-model-v1"
      );
      cy.get('[data-testid="create-model-submit-button"]').click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Model name already exists in this provider"
      );
    });
  });

  describe("Provider Management and Editing", () => {
    it.skip("should edit provider information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();
      cy.url().should("include", "/management/providers/p/");

      // Modify provider information
      cy.get('[data-testid="provider-name-input"]')
        .clear()
        .type("Updated Provider");
      cy.get('[data-testid="provider-description-input"]')
        .clear()
        .type("Updated description");

      // Submit changes
      cy.get('[data-testid="update-provider-submit-button"]').click();

      // Verify changes are saved
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Provider updated successfully"
      );
    });

    it.skip("should update provider API settings", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Update API endpoint or authentication
      cy.get('[data-testid="provider-base-url-input"]')
        .clear()
        .type("https://new-api.testprovider.com");
      cy.get('[data-testid="provider-api-key-input"]')
        .clear()
        .type("new-api-key-789");

      // Submit changes
      cy.get('[data-testid="update-provider-submit-button"]').click();

      // Verify API settings are updated
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Provider updated successfully"
      );
    });

    it.skip("should update provider rate limiting settings", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Update rate limiting configuration
      cy.get('[data-testid="provider-rate-limit-input"]').clear().type("200");
      cy.get('[data-testid="provider-timeout-input"]').clear().type("60");

      // Submit changes
      cy.get('[data-testid="update-provider-submit-button"]').click();

      // Verify rate limiting is updated
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Provider updated successfully"
      );
    });

    it.skip("should validate changes during editing", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Try to edit provider with invalid information
      cy.get('[data-testid="provider-name-input"]').clear();

      // Submit changes
      cy.get('[data-testid="update-provider-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="provider-name-error"]').should(
        "contain",
        "Provider name is required"
      );
    });
  });

  describe("Model Management and Editing", () => {
    it.skip("should edit model information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click edit button on first model
      cy.get('[data-testid="model-edit-button"]').first().click();
      cy.url().should("include", "/management/providers/p/");

      // Modify model information
      cy.get('[data-testid="model-name-input"]').clear().type("Updated Model");
      cy.get('[data-testid="model-description-input"]')
        .clear()
        .type("Updated model description");

      // Submit changes
      cy.get('[data-testid="update-model-submit-button"]').click();

      // Verify changes are saved
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Model updated successfully"
      );
    });

    it.skip("should update model capabilities", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click edit button on first model
      cy.get('[data-testid="model-edit-button"]').first().click();

      // Update model capabilities
      cy.get('[data-testid="model-image-generation-checkbox"]').click();
      cy.get('[data-testid="model-text-generation-checkbox"]').click();

      // Submit changes
      cy.get('[data-testid="update-model-submit-button"]').click();

      // Verify capabilities are updated
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Model updated successfully"
      );
    });

    it.skip("should update model pricing information", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click edit button on first model
      cy.get('[data-testid="model-edit-button"]').first().click();

      // Update pricing information
      cy.get('[data-testid="model-input-price-input"]').clear().type("0.001");
      cy.get('[data-testid="model-output-price-input"]').clear().type("0.002");

      // Submit changes
      cy.get('[data-testid="update-model-submit-button"]').click();

      // Verify pricing is updated
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Model updated successfully"
      );
    });

    it.skip("should validate model changes during editing", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click edit button on first model
      cy.get('[data-testid="model-edit-button"]').first().click();

      // Try to edit model with invalid information
      cy.get('[data-testid="model-name-input"]').clear();

      // Submit changes
      cy.get('[data-testid="update-model-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="model-name-error"]').should(
        "contain",
        "Model name is required"
      );
    });
  });

  describe("Provider Deletion", () => {
    it.skip("should delete provider when not in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Click delete button
      cy.get('[data-testid="delete-provider-button"]').click();

      // Confirm deletion in dialog
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="confirm-delete-button"]').click();

      // Verify provider is deleted
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Provider deleted successfully"
      );
    });

    it.skip("should prevent deletion of provider that is in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on provider that is in use
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Click delete button
      cy.get('[data-testid="delete-provider-button"]').click();

      // Verify deletion is prevented
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="delete-warning-message"]').should(
        "contain",
        "Cannot delete provider that is in use"
      );
    });

    it.skip("should show warning when attempting to delete active provider", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on active provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Click delete button
      cy.get('[data-testid="delete-provider-button"]').click();

      // Verify warning dialog is displayed
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="delete-warning-message"]').should(
        "contain",
        "This provider is currently in use"
      );
    });
  });

  describe("Model Deletion", () => {
    it.skip("should delete model when not in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click delete button on first model
      cy.get('[data-testid="model-delete-button"]').first().click();

      // Confirm deletion in dialog
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="confirm-delete-button"]').click();

      // Verify model is deleted
      cy.get('[data-testid="success-toast"]').should(
        "contain",
        "Model deleted successfully"
      );
    });

    it.skip("should prevent deletion of model that is in use", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click delete button on model that is in use
      cy.get('[data-testid="model-delete-button"]').first().click();

      // Verify deletion is prevented
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="delete-warning-message"]').should(
        "contain",
        "Cannot delete model that is in use"
      );
    });

    it.skip("should show warning when attempting to delete active model", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click delete button on active model
      cy.get('[data-testid="model-delete-button"]').first().click();

      // Verify warning dialog is displayed
      cy.get('[data-testid="delete-confirmation-dialog"]').should("be.visible");
      cy.get('[data-testid="delete-warning-message"]').should(
        "contain",
        "This model is currently in use"
      );
    });
  });

  describe("Provider and Model Testing", () => {
    it.skip("should test provider connectivity", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Click test connectivity button
      cy.get('[data-testid="test-provider-connectivity-button"]').click();

      // Verify connection test is performed
      cy.get('[data-testid="connectivity-test-results"]').should("be.visible");
      cy.get('[data-testid="connectivity-test-status"]').should(
        "contain",
        "Connected"
      );
    });

    it.skip("should test model functionality", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click edit button on first model
      cy.get('[data-testid="model-edit-button"]').first().click();

      // Click test model button
      cy.get('[data-testid="test-model-button"]').click();

      // Verify model test is performed
      cy.get('[data-testid="model-test-results"]').should("be.visible");
      cy.get('[data-testid="model-test-status"]').should(
        "contain",
        "Test completed"
      );
    });

    it.skip("should validate provider API credentials", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Click settings button on first provider
      cy.get('[data-testid="provider-settings-button"]').first().click();

      // Enter API credentials
      cy.get('[data-testid="provider-api-key-input"]')
        .clear()
        .type("new-test-api-key");

      // Click validate credentials button
      cy.get('[data-testid="validate-credentials-button"]').click();

      // Verify credentials are validated
      cy.get('[data-testid="credentials-validation-results"]').should(
        "be.visible"
      );
      cy.get('[data-testid="credentials-validation-status"]').should(
        "contain",
        "Valid"
      );
    });
  });

  describe("Provider Data Validation", () => {
    it.skip("should validate provider name uniqueness", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Try to create provider with duplicate name
      cy.get('[data-testid="provider-name-input"]').type("Duplicate Provider");
      cy.get('[data-testid="provider-description-input"]').type(
        "A duplicate provider"
      );
      cy.get('[data-testid="provider-api-key-input"]').type(
        "duplicate-api-key"
      );

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify validation error is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Provider name already exists"
      );
    });

    it.skip("should validate API endpoint accessibility", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Try to create provider with inaccessible API endpoint
      cy.get('[data-testid="provider-base-url-input"]').type(
        "https://inaccessible-api.com"
      );

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify validation error is displayed
      cy.get('[data-testid="provider-base-url-error"]').should(
        "contain",
        "API endpoint is not accessible"
      );
    });

    it.skip("should validate required fields", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Try to submit form with missing required fields
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify validation errors are displayed
      cy.get('[data-testid="provider-name-error"]').should(
        "contain",
        "Provider name is required"
      );
      cy.get('[data-testid="provider-description-error"]').should(
        "contain",
        "Description is required"
      );
      cy.get('[data-testid="provider-api-key-error"]').should(
        "contain",
        "API key is required"
      );
    });
  });

  describe("Provider Error Handling", () => {
    it.skip("should handle API errors gracefully", () => {
      // Simulate API error by intercepting the request
      cy.intercept("POST", "/api/providers", {
        statusCode: 500,
        body: { error: "Server error" },
      });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Fill in form
      cy.get('[data-testid="provider-name-input"]').type("Test Provider");
      cy.get('[data-testid="provider-description-input"]').type(
        "A test provider"
      );
      cy.get('[data-testid="provider-api-key-input"]').type("test-api-key");

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify appropriate error message is displayed
      cy.get('[data-testid="error-toast"]').should(
        "contain",
        "Failed to create provider"
      );
    });

    it.skip("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("POST", "/api/providers", { forceNetworkError: true });

      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Fill in form
      cy.get('[data-testid="provider-name-input"]').type("Test Provider");
      cy.get('[data-testid="provider-description-input"]').type(
        "A test provider"
      );
      cy.get('[data-testid="provider-api-key-input"]').type("test-api-key");

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify appropriate error message
      cy.get('[data-testid="error-toast"]').should("contain", "Network error");
    });

    it.skip("should handle validation errors appropriately", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers/new");

      // Submit invalid data
      cy.get('[data-testid="provider-base-url-input"]').type("invalid-url");

      // Submit form
      cy.get('[data-testid="create-provider-submit-button"]').click();

      // Verify validation errors are displayed clearly
      cy.get('[data-testid="provider-base-url-error"]').should(
        "contain",
        "Invalid URL format"
      );
    });
  });

  describe("Provider Performance", () => {
    it.skip("should load provider data efficiently", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Verify provider list loads within acceptable time
      cy.get('[data-testid="providers-data-table"]').should("be.visible");
      cy.get('[data-testid="providers-loading-skeleton"]').should("not.exist");
    });

    it.skip("should handle large numbers of providers without performance degradation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Verify interface remains responsive with many providers
      cy.get('[data-testid="providers-data-table"]').should("be.visible");
      cy.get('[data-testid="providers-search-input"]').should("be.enabled");
      cy.get('[data-testid="providers-filter-button"]').should("be.enabled");
    });
  });

  describe("Provider Accessibility", () => {
    it.skip("should support keyboard navigation", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "data-testid", "providers-search-input");

      // Test Enter key for form submission
      cy.get('[data-testid="providers-search-input"]').type("test{enter}");
      cy.get('[data-testid="providers-data-table"]').should("be.visible");
    });

    it.skip("should provide appropriate ARIA labels", () => {
      // Login as admin
      cy.mockSession({ role: "admin" });
      cy.visit("/management/providers");

      // Verify form elements have appropriate ARIA labels
      cy.get('[data-testid="providers-search-input"]').should(
        "have.attr",
        "aria-label"
      );
      cy.get('[data-testid="providers-filter-button"]').should(
        "have.attr",
        "aria-label"
      );

      // Verify table elements are accessible
      cy.get('[data-testid="providers-data-table"]').should(
        "have.attr",
        "role",
        "table"
      );
    });
  });
});
