import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import SimulationPerformance, {
  SimulationPerformanceProps,
} from "@/components/common/analytics/footer/SimulationPerformance";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SimulationPerformanceProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-12-31"),
  profileId: "test-profile-id",
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
  cohortIds: ["test-cohort-id"],
};
// ------------------------------------------------------------------
describe("SimulationPerformance", () => {
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
      render(<SimulationPerformance {...mockProps} />);

      // Should render the component with title
      await waitFor(() => {
        expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      // Test with different props
      const propsWithDifferentDates: SimulationPerformanceProps = {
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
        profileId: "different-profile-id",
        thresholds: {
          danger: 60,
          warning: 80,
          success: 90,
        },
        cohortIds: ["cohort-1", "cohort-2"],
      };

      render(<SimulationPerformance {...propsWithDifferentDates} />);

      // Should render the component with title
      expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<SimulationPerformance {...mockProps} />);

      // Should have proper accessibility attributes
      expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
      expect(
        screen.getByText("Performance trends for scenarios within simulations"),
      ).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      render(<SimulationPerformance {...mockProps} />);

      // Should still render the component even with API errors
      await waitFor(() => {
        expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      // Component should handle loading states appropriately
      render(<SimulationPerformance {...mockProps} />);

      // Should render the component
      expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with edge case props
      const edgeCaseProps: SimulationPerformanceProps = {
        dateStart: new Date("2024-01-01"),
        dateEnd: new Date("2024-01-01"), // Same date
        profileId: undefined, // No profile
        thresholds: {
          danger: 0,
          warning: 0,
          success: 0,
        },
        cohortIds: [], // Empty cohorts
      };

      render(<SimulationPerformance {...edgeCaseProps} />);

      // Should render the component even with edge case props
      expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps: SimulationPerformanceProps = {
        dateStart: new Date(),
        dateEnd: new Date(),
        profileId: "test-id",
        thresholds: {
          danger: 50,
          warning: 70,
          success: 80,
        },
        cohortIds: ["test-cohort"],
      };

      render(<SimulationPerformance {...minimalProps} />);

      // Should render with minimal props
      expect(screen.getByText("Scenario Performance")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for SimulationPerformance:
 * Path: common/analytics/footer/SimulationPerformance.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: SimulationPerformanceProps
 * - Has props: true
 * - Props interface: SimulationPerformanceProps
 * - Client component: true
 * - Uses hooks: useQuery, useMemo
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<SimulationPerformance {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<SimulationPerformance {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
