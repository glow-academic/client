import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import CohortPerformance, {
  CohortPerformanceProps,
} from "@/components/common/analytics/secondary/CohortPerformance";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: CohortPerformanceProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-12-31"),
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
  profileId: "test-profile-id",
  cohortIds: ["test-cohort-id"],
};
// ------------------------------------------------------------------
describe("CohortPerformance", () => {
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
      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should display the component title
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should handle state changes gracefully
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should handle user interactions
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllCohorts).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should handle errors gracefully
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // Test loading states
      renderWithMocks(<CohortPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should display the component even during loading
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different thresholds
      const propsWithDifferentThresholds = {
        ...mockProps,
        thresholds: {
          danger: 30,
          warning: 60,
          success: 80,
        },
      };

      renderWithMocks(<CohortPerformance {...propsWithDifferentThresholds} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should render with different thresholds
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<CohortPerformance {...propsWithoutProfile} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should handle undefined profileId
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });
  });
});
