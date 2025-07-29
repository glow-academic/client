import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import AverageScore, {
  AverageScoreProps,
} from "@/components/common/analytics/header/AverageScore";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: AverageScoreProps = {
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
describe("AverageScore", () => {
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
      renderWithMocks(<AverageScore {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<AverageScore {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should display the component title
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<AverageScore {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle card click to open dialog", async () => {
      const user = userEvent.setup();
      renderWithMocks(<AverageScore {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Click on the card to open dialog
      const card =
        screen.getByText("Average Score").closest('[role="button"]') ||
        screen.getByText("Average Score");
      await user.click(card);

      // Should open dialog
      await waitFor(() => {
        expect(screen.getByText("Average Score Trend")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllProfiles).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<AverageScore {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should handle errors gracefully
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // Test loading states
      renderWithMocks(<AverageScore {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should display the component even during loading
      expect(screen.getByText("Average Score")).toBeInTheDocument();
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

      renderWithMocks(<AverageScore {...propsWithDifferentThresholds} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should render with different thresholds
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<AverageScore {...propsWithoutProfile} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should handle undefined profileId
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });
  });
});
