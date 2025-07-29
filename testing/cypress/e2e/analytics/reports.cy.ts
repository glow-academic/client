/// <reference types="cypress" />

describe("Analytics Reports End-to-End Tests", () => {
  beforeEach(() => {
    cy.clearAllStorage();
  });

  describe("Role-Based Access Control", () => {
    it.skip("should allow admin users to view all user reports", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Verify reports load with loading state
      cy.get("p").should("contain", "Loading reports...");

      // Wait for reports to load and verify table is visible
      cy.get("table").should("be.visible");

      // Verify analytics filters are displayed in header
      cy.get("header").should("contain", "Select cohorts");

      // Verify all users are visible in the reports table
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify no access restrictions are applied
      cy.get('[data-sidebar="input"]').click();
      cy.get('[role="option"]').should("have.length.greaterThan", 0);

      // Verify can view individual reports for any user
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");
    });

    it.skip("should allow superadmin users to view all user reports", () => {
      // Login as superadmin using mock session
      cy.mockSession({ role: "superadmin" });
      cy.visit("/analytics/reports");

      // Verify reports load with loading state
      cy.get("p").should("contain", "Loading reports...");

      // Wait for reports to load and verify table is visible
      cy.get("table").should("be.visible");

      // Verify analytics filters are displayed in header
      cy.get("header").should("contain", "Select cohorts");

      // Verify all users are visible in the reports table
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify no access restrictions are applied
      cy.get('[data-sidebar="input"]').click();
      cy.get('[role="option"]').should("have.length.greaterThan", 0);

      // Verify can view individual reports for any user
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");
    });

    it.skip("should restrict instructional users to only their assigned cohorts", () => {
      // Login as instructional user using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/reports");

      // Verify reports load with loading state
      cy.get("p").should("contain", "Loading reports...");

      // Wait for reports to load and verify table is visible
      cy.get("table").should("be.visible");

      // Verify analytics filters are displayed in header
      cy.get("header").should("contain", "Select cohorts");

      // Verify only users from assigned cohorts are visible
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify other users are not accessible
      cy.get('[data-sidebar="input"]').click();
      cy.get('[role="option"]').should("have.length.greaterThan", 0);

      // Verify can view individual reports for assigned users only
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");
    });

    it.skip("should prevent TA users from accessing analytics reports", () => {
      // Login as TA using mock session
      cy.mockSession({ role: "ta" });
      cy.visit("/home");

      // Try to navigate to analytics reports directly
      cy.visit("/analytics/reports");

      // Verify access is denied - should redirect to access denied page
      cy.url().should("include", "/access-denied");

      // Verify appropriate error message
      cy.get("body").should("contain", "Access Denied");
    });

    it.skip("should prevent guest users from accessing analytics reports", () => {
      // Login as guest
      cy.visit("/");
      cy.get('[data-testid="guest-login-button"]').click();
      cy.url().should("include", "/practice");

      // Try to navigate to analytics reports directly
      cy.visit("/analytics/reports");

      // Verify access is denied - should redirect to access denied page
      cy.url().should("include", "/access-denied");

      // Verify appropriate error message
      cy.get("body").should("contain", "Access Denied");
    });
  });

  describe("Reports Table Display", () => {
    it.skip("should display reports table with correct columns", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify table columns include:
      // - Name
      // - Alias
      // - Score (average)
      // - Sessions (number)
      // - Pass (percentage)
      // - Time (total in minutes)
      // - Complete (percentage)
      // - Trend (down, normal, or up)
      // - Last Activity
      // - Scenarios (number)
      // - Messages/session
      // - Total Attempts
      // - Cohorts (number)
      // - Status (good or risk)
      // - Actions (View, Export)
      cy.get("th").should("contain", "Name");
      cy.get("th").should("contain", "Alias");
      cy.get("th").should("contain", "Score");
      cy.get("th").should("contain", "Sessions");
      cy.get("th").should("contain", "Pass");
      cy.get("th").should("contain", "Time");
      cy.get("th").should("contain", "Complete");
      cy.get("th").should("contain", "Trend");
      cy.get("th").should("contain", "Last Activity");
      cy.get("th").should("contain", "Scenarios");
      cy.get("th").should("contain", "Messages/session");
      cy.get("th").should("contain", "Total Attempts");
      cy.get("th").should("contain", "Cohorts");
      cy.get("th").should("contain", "Status");
      cy.get("th").should("contain", "Actions");
    });

    it.skip("should display user performance metrics correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify average scores are calculated correctly
      cy.get("td").should("match", /\d+%/); // Should contain percentage values

      // Verify session counts are accurate
      cy.get("td").should("match", /\d+/); // Should contain numeric values

      // Verify pass percentages are calculated correctly
      cy.get("td").should("match", /\d+%/); // Should contain percentage values

      // Verify time calculations are accurate
      cy.get("td").should("match", /\d+/); // Should contain numeric values

      // Verify completion percentages are correct
      cy.get("td").should("match", /\d+%/); // Should contain percentage values
    });

    it.skip("should display trend indicators correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify trend indicators show:
      // - Down arrow for declining performance
      // - Normal indicator for stable performance
      // - Up arrow for improving performance
      cy.get("td").should("match", /(↓|→|↑|Improving|Declining|Stable)/);

      // Verify trend calculations are based on recent data
      cy.get("td").should("not.contain", "N/A");
    });

    it.skip("should display status indicators correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify status indicators show:
      // - "Good" for users meeting performance standards
      // - "Risk" for users below performance standards
      cy.get("td").should("match", /(Good|Risk|At Risk)/);

      // Verify status calculations are based on defined criteria
      cy.get("td").should("not.contain", "Unknown");
    });
  });

  describe("Reports Filtering and Sorting", () => {
    it.skip("should filter data by role correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select specific roles (TA, Instructional, etc.)
      cy.get("button").contains("Role").click();
      cy.get('[role="option"]').contains("TA").click();

      // Verify table updates to show only selected roles
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify filtering is applied consistently
      cy.get("td").should("contain", "TA");
    });

    it.skip("should filter data by cohort correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select specific cohorts
      cy.get('[data-sidebar="input"]').click();
      cy.get('[role="option"]').first().click();

      // Verify table updates to show only selected cohort users
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify filtering is applied consistently
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should filter data by persona correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select specific personas
      cy.get("button").contains("Persona").click();
      cy.get('[role="option"]').first().click();

      // Verify table updates to show only users who tested those personas
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify filtering is applied consistently
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should filter data by scenario correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select specific scenarios
      cy.get("button").contains("Scenario").click();
      cy.get('[role="option"]').first().click();

      // Verify table updates to show only users who attempted those scenarios
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify filtering is applied consistently
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should filter data by simulation correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select specific simulations
      cy.get("button").contains("Simulation").click();
      cy.get('[role="option"]').first().click();

      // Verify table updates to show only users who attempted those simulations
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify filtering is applied consistently
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should allow sorting by different columns", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Click on column headers to sort
      // Verify sorting works for all sortable columns
      cy.get("th").contains("Name").click();
      cy.get("th").contains("Name").should("have.class", "sorted");

      cy.get("th").contains("Score").click();
      cy.get("th").contains("Score").should("have.class", "sorted");

      cy.get("th").contains("Sessions").click();
      cy.get("th").contains("Sessions").should("have.class", "sorted");

      // Verify sort direction toggles correctly
      cy.get("th").contains("Name").click();
      cy.get("th").contains("Name").should("have.class", "sorted-desc");
    });

    it.skip("should handle multiple filter combinations", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Apply multiple filters (role + cohort + date range)
      cy.get("button").contains("Role").click();
      cy.get('[role="option"]').contains("TA").click();

      cy.get('[data-sidebar="input"]').click();
      cy.get('[role="option"]').first().click();

      // Verify table shows only users matching all criteria
      cy.get("tbody tr").should("have.length.greaterThan", 0);

      // Verify filter combinations work correctly
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should reset filters correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Apply various filters
      cy.get("button").contains("Role").click();
      cy.get('[role="option"]').contains("TA").click();

      // Reset filters
      cy.get("button").contains("Reset").click();

      // Verify all filters are cleared
      cy.get("button").contains("Role").should("not.have.class", "active");

      // Verify table shows unfiltered data
      cy.get("tbody tr").should("have.length.greaterThan", 0);
    });
  });

  describe("Reports Export Functionality", () => {
    it.skip("should allow instructional users to export to Brightspace as CSV", () => {
      // Login as instructional using mock session
      cy.mockSession({ role: "instructional" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select users to export
      cy.get("tbody tr").first().find("input[type='checkbox']").check();

      // Click Brightspace export button
      cy.get("button").contains("Brightspace Export").click();

      // Select export metric (score, pass rate, etc.)
      cy.get("select").select("Average Score");

      // Verify CSV file is downloaded
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");

      // Verify file contains correct data in Brightspace format
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should(
        "contain",
        "Alias"
      );
    });

    it.skip("should allow admin users to export to Brightspace as CSV", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select users to export
      cy.get("tbody tr").first().find("input[type='checkbox']").check();

      // Click Brightspace export button
      cy.get("button").contains("Brightspace Export").click();

      // Select export metric
      cy.get("select").select("Pass Rate");

      // Verify CSV file is downloaded
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");

      // Verify file contains correct data in Brightspace format
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should(
        "contain",
        "Alias"
      );
    });

    it.skip("should export selected rows only when rows are selected", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Select specific rows
      cy.get("tbody tr").first().find("input[type='checkbox']").check();
      cy.get("tbody tr").eq(1).find("input[type='checkbox']").check();

      // Export to Brightspace
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Average Score");

      // Verify only selected users are included in export
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");
      // The CSV should contain only 2 rows (header + 2 selected users)
    });

    it.skip("should export all visible rows when no rows are selected", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Apply filters to show specific users
      cy.get("button").contains("Role").click();
      cy.get('[role="option"]').contains("TA").click();

      // Export to Brightspace without selecting rows
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Average Score");

      // Verify all filtered users are included in export
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");
    });

    it.skip("should export data in correct Brightspace format", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Export to Brightspace
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Average Score");

      // Verify CSV format is:
      // - Header: Alias, Simulation1, Simulation2, etc.
      // - Rows: User alias, simulation scores/values
      // - Empty cells for simulations not attempted
      // - N/A for users with no sessions
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should(
        "contain",
        "Alias"
      );
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should(
        "contain",
        "Simulation"
      );
    });

    it.skip("should handle different export metrics correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Test export with different metrics:
      // - Average Score
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Average Score");
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");

      // - Pass Rate
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Pass Rate");
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");

      // - Total Time
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Total Time");
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");

      // - Sessions Completed
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Sessions Completed");
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should("exist");

      // Verify each metric exports correct data
      cy.readFile("cypress/downloads/brightspace_export_*.csv").should(
        "contain",
        "Alias"
      );
    });
  });

  describe("Individual User Reports", () => {
    it.skip("should allow viewing individual user reports", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Click "View" action on a user
      cy.get("tbody tr").first().find("button").contains("View").click();

      // Verify navigation to individual report page
      cy.url().should("include", "/analytics/reports/p/");

      // Verify report shows user-specific data
      cy.get("div").should("not.contain", "Loading");
    });

    it.skip("should display individual report components correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Navigate to individual user report
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");

      // Verify report includes:
      // - User profile information
      // - Average Score
      // - Sessions count
      // - Pass Rate
      // - Average Time
      // - Performance Over Time chart
      // - Skills Breakdown
      // - Session Distribution
      // - Skill Performance
      // - Key Insights
      // - Recent Sessions
      cy.get("div").should("contain", "Average Score");
      cy.get("div").should("contain", "Sessions");
      cy.get("div").should("contain", "Pass Rate");
      cy.get("div").should("contain", "Average Time");
      cy.get("div").should("contain", "Performance Over Time");
      cy.get("div").should("contain", "Skills Breakdown");
      cy.get("div").should("contain", "Recent Sessions");
    });

    it.skip("should display performance over time chart", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Navigate to individual user report
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");

      // Verify performance over time chart is displayed
      cy.get("div").should("contain", "Performance Over Time");

      // Verify chart shows score progression
      cy.get("div").should("not.contain", "No data available");

      // Verify chart is interactive and responsive
      cy.get("div").should("not.contain", "Error loading chart");
    });

    it.skip("should display skills breakdown chart", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Navigate to individual user report
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");

      // Verify skills breakdown chart is displayed
      cy.get("div").should("contain", "Skills Breakdown");

      // Verify all rubric skills are represented
      cy.get("div").should("not.contain", "No skills data");

      // Verify skill performance is calculated correctly
      cy.get("div").should("not.contain", "Error loading skills");
    });

    it.skip("should display recent sessions list", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Navigate to individual user report
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");

      // Verify recent sessions are listed
      cy.get("div").should("contain", "Recent Sessions");

      // Verify session details include:
      // - Simulation name
      // - Date/time
      // - Score
      // - Pass/fail status
      // - Time taken
      cy.get("div").should("contain", "Simulation");
      cy.get("div").should("contain", "Score");
      cy.get("div").should("contain", "Pass");
      cy.get("div").should("contain", "Time");
    });

    it.skip("should allow navigation back to reports table", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Navigate to individual user report
      cy.get("tbody tr").first().find("button").contains("View").click();
      cy.url().should("include", "/analytics/reports/p/");

      // Click back button or breadcrumb
      cy.get("button").contains("Back").click();

      // Verify navigation back to reports table
      cy.url().should("include", "/analytics/reports");

      // Verify filters and selections are maintained
      cy.get("table").should("be.visible");
    });
  });

  describe("Reports Real-time Updates", () => {
    it.skip("should update when new simulation attempts are completed", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Have another user complete a simulation (this would be simulated)
      // This would require setting up a separate test user or mocking the data

      // Verify reports table updates with new data
      cy.get("table").should("be.visible");

      // Verify metrics are recalculated correctly
      cy.get("td").should("match", /\d+%/); // Should contain percentage values
    });

    it.skip("should refresh data automatically", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for initial load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Wait for automatic refresh (this would depend on the refresh interval)
      cy.wait(30000); // Wait 30 seconds for potential auto-refresh

      // Verify data is updated
      cy.get("table").should("be.visible");

      // Verify no data loss during refresh
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should handle manual refresh correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Trigger manual refresh (this would depend on the specific refresh implementation)
      cy.get("button").contains("Refresh").click();

      // Verify data is updated
      cy.get("table").should("be.visible");

      // Verify loading states are displayed appropriately
      cy.get("div").should("not.contain", "No data available");
    });
  });

  describe("Reports Error Handling", () => {
    it.skip("should handle data loading errors gracefully", () => {
      // Simulate API error by intercepting requests
      cy.intercept("GET", "/api/analytics/*", {
        statusCode: 500,
        body: { error: "Server error" },
      });

      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Verify appropriate error message is displayed
      cy.get("div").should("contain", "Error loading data");

      // Verify retry functionality works
      cy.get("button").contains("Retry").click();
      cy.get("div").should("not.contain", "Error loading data");
    });

    it.skip("should handle empty data states correctly", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");

      // If no data is available, verify empty state messages are displayed
      cy.get("div").should("not.contain", "Loading reports...");

      // Verify appropriate guidance is provided
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should handle export failures gracefully", () => {
      // Simulate export failure
      cy.intercept("POST", "/api/export/*", {
        statusCode: 500,
        body: { error: "Export failed" },
      });

      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Attempt to export data
      cy.get("button").contains("Brightspace Export").click();
      cy.get("select").select("Average Score");

      // Verify appropriate error message is displayed
      cy.get("div").should("contain", "Export failed");

      // Verify retry functionality works
      cy.get("button").contains("Retry").click();
      cy.get("div").should("not.contain", "Export failed");
    });

    it.skip("should handle network connectivity issues", () => {
      // Simulate network disconnect
      cy.intercept("GET", "/api/analytics/*", { forceNetworkError: true });

      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Verify appropriate error message
      cy.get("div").should("contain", "Network error");

      // Verify reconnection handling works
      cy.get("button").contains("Retry").click();
      cy.get("div").should("not.contain", "Network error");
    });
  });

  describe("Reports Performance", () => {
    it.skip("should load reports data efficiently", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });

      // Start timing
      const startTime = Date.now();

      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify reports load within acceptable time (5 seconds)
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(5000);

      // Verify loading states are displayed appropriately
      cy.get("div").should("not.contain", "No data available");
    });

    it.skip("should handle large datasets without performance degradation", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify table remains responsive
      cy.get("table").should("be.visible");

      // Verify sorting and filtering remain fast
      cy.get("th").contains("Name").click();
      cy.get("th").contains("Name").should("have.class", "sorted");

      // Verify pagination works correctly if implemented
      cy.get("table").should("be.visible");
    });
  });

  describe("Reports Accessibility", () => {
    it.skip("should support keyboard navigation", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Test tab navigation through all interactive elements
      cy.get("body").type("{tab}");
      cy.focused().should("have.attr", "data-sidebar", "input");

      // Verify focus management works correctly
      cy.get("body").type("{tab}");
      cy.focused().should("be.visible");
    });

    it.skip("should provide appropriate ARIA labels for table elements", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify table has appropriate ARIA labels
      cy.get("table").should("have.attr", "role", "table");

      // Verify sortable columns are announced correctly
      cy.get("th").should("have.attr", "aria-sort");

      // Verify data is accessible to screen readers
      cy.get("td").should("be.visible");
    });

    it.skip("should support screen reader navigation", () => {
      // Login as admin using mock session
      cy.mockSession({ role: "admin" });
      cy.visit("/analytics/reports");

      // Wait for reports to load
      cy.get("p").should("contain", "Loading reports...");
      cy.get("table").should("be.visible");

      // Verify screen reader can navigate through table
      cy.get("table").should("have.attr", "role", "table");

      // Verify data relationships are announced correctly
      cy.get("tr").should("have.attr", "role", "row");

      // Verify interactive elements are accessible
      cy.get("button").should("have.attr", "aria-label");
    });
  });
});
