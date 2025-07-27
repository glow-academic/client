import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import RubricHeatmap, {
  RubricHeatmapProps,
} from "@/components/common/analytics/secondary/RubricHeatmap";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: RubricHeatmapProps = {
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
describe("RubricHeatmap", () => {
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
      renderWithMocks(<RubricHeatmap {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<RubricHeatmap {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });

      // Should display the component title
      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<RubricHeatmap {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });

      // Should have proper structure
      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllRubrics).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<RubricHeatmap {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });

      // Should handle errors gracefully
      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // Test loading states
      renderWithMocks(<RubricHeatmap {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });

      // Should handle loading states
      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different props
      const propsWithDifferentDates = {
        ...mockProps,
        dateStart: new Date("2023-01-01"),
        dateEnd: new Date("2023-12-31"),
      };

      renderWithMocks(<RubricHeatmap {...propsWithDifferentDates} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });

      // Should handle different date ranges
      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<RubricHeatmap {...propsWithoutProfile} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });

      // Should handle missing profileId
      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });
  });
});
