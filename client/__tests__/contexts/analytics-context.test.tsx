import { AnalyticsProvider, useAnalytics } from "@/contexts/analytics-context";
import { renderWithMocks } from "@/test/renderWithMocks";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
interface AnalyticsProviderProps {
  children: React.ReactNode;
}

const mockProps: AnalyticsProviderProps = {
  children: <div>test-children</div>,
};

// Test component to access analytics context
function TestComponent() {
  const { startDate, endDate, cohorts } = useAnalytics();
  return (
    <div>
      <div data-testid="start-date">{startDate.toISOString()}</div>
      <div data-testid="end-date">{endDate.toISOString()}</div>
      <div data-testid="cohorts-count">{cohorts.length}</div>
    </div>
  );
}

// ------------------------------------------------------------------
describe("analytics-context", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      renderWithMocks(<AnalyticsProvider {...mockProps} />);

      // TODO: Add meaningful assertions based on your component
      // Example: expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });

    it("should use earliest cohort creation date as default start date", async () => {
      // Mock cohorts with different creation dates
      const mockCohorts = [
        {
          id: "cohort-1",
          createdAt: "2024-01-15T00:00:00.000Z", // Earliest date
          updatedAt: "2024-01-15T00:00:00.000Z",
          title: "Cohort 1",
          description: "First cohort",
          active: true,
          profileIds: ["profile-1"],
          defaultCohort: false,
          simulationIds: ["sim-1"],
        },
        {
          id: "cohort-2",
          createdAt: "2024-02-15T00:00:00.000Z", // Later date
          updatedAt: "2024-02-15T00:00:00.000Z",
          title: "Cohort 2",
          description: "Second cohort",
          active: true,
          profileIds: ["profile-2"],
          defaultCohort: false,
          simulationIds: ["sim-2"],
        },
        {
          id: "cohort-3",
          createdAt: "2024-03-15T00:00:00.000Z", // Latest date
          updatedAt: "2024-03-15T00:00:00.000Z",
          title: "Cohort 3",
          description: "Third cohort",
          active: false, // Inactive cohort should be ignored
          profileIds: ["profile-3"],
          defaultCohort: false,
          simulationIds: ["sim-3"],
        },
      ];

      vi.mocked(getAllCohorts).mockResolvedValue(mockCohorts);

      renderWithMocks(
        <AnalyticsProvider>
          <TestComponent />
        </AnalyticsProvider>
      );

      // Wait for the component to render with the mocked data
      await screen.findByTestId("start-date");

      const startDateElement = screen.getByTestId("start-date");
      const startDate = new Date(startDateElement.textContent!);

      // The start date should be the earliest cohort creation date (2024-01-15)
      const expectedStartDate = new Date("2024-01-15T00:00:00.000Z");
      expect(startDate.getTime()).toBe(expectedStartDate.getTime());

      // Verify that we have cohorts (the exact count may vary due to mock data)
      const cohortsCountElement = screen.getByTestId("cohorts-count");
      const cohortCount = parseInt(cohortsCountElement.textContent || "0");
      expect(cohortCount).toBeGreaterThan(0); // Should have at least some cohorts
    });

    it("should fallback to 30 days ago when no cohorts are available", async () => {
      // Mock empty cohorts array
      vi.mocked(getAllCohorts).mockResolvedValue([]);

      renderWithMocks(
        <AnalyticsProvider>
          <TestComponent />
        </AnalyticsProvider>
      );

      // Wait for the component to render with the mocked data
      await screen.findByTestId("start-date");

      const startDateElement = screen.getByTestId("start-date");
      const startDate = new Date(startDateElement.textContent!);

      // The start date should be approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Allow for a small time difference (within 1 minute) due to test execution time
      const timeDifference = Math.abs(
        startDate.getTime() - thirtyDaysAgo.getTime()
      );
      expect(timeDifference).toBeLessThan(60000); // 1 minute in milliseconds
    });

    it.skip("should render with props", () => {
      // TODO: Test component with various props
      // Props interface: AnalyticsProviderProps
      // TODO add props assertions
    });

    it.skip("should have correct accessibility attributes", () => {
      // TODO: Test accessibility features
      // TODO add accessibility assertions
    });
  });

  describe("User Interactions", () => {
    it.skip("should handle state changes", async () => {
      const user = userEvent.setup();
      void user;
      // TODO: state management assertions
      // Mock data is available from @/mocks/schema for realistic testing
    });

    it.skip("should handle user events", async () => {
      const user = userEvent.setup();
      void user;
      // TODO: interaction assertions
    });
  });

  describe("API Integration", () => {
    it.skip("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllCohorts).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<AnalyticsProvider {...mockProps} />);

      // Assert: Check that your component shows an error message.
      // TODO: Add specific error state assertions
    });

    it.skip("should handle loading states", () => {
      // TODO: Test loading states
      // Mock data is automatically loaded from @/mocks/schema
      // TODO: loading states assertions
    });
  });

  describe("Edge Cases", () => {
    it.skip("should handle edge cases gracefully", () => {
      // TODO: Test edge cases and error scenarios
      // TODO: edge-case assertions
    });

    it.skip("should handle missing or invalid props", () => {
      // TODO: Test with missing/invalid props
      // TODO: invalid props assertions
    });
  });
});

/*
 * Component Analysis for analytics-context:
 * Path: analytics-context.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: AnalyticsProvider, useAnalytics
 * - Has props: true
 * - Props interface: AnalyticsProviderProps
 * - Client component: true
 * - Uses hooks: useQuery, useContext, useMemo, useState, useProfile, useAnalytics
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: true
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<analytics-context {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<analytics-context {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
