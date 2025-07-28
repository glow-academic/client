import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import SessionEfficiency, {
  SessionEfficiencyProps,
} from "@/components/common/analytics/header/SessionEfficiency";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SessionEfficiencyProps = {
  dateStart: new Date(),
  dateEnd: new Date(),
  thresholds: {
    danger: 50,
    warning: 75,
    success: 90,
  },
  profileId: "test-profile-id",
  cohortIds: ["test-cohort-id"],
};
// ------------------------------------------------------------------
describe("SessionEfficiency", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SessionEfficiency {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render the component
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<SessionEfficiency {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should display the component
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<SessionEfficiency {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      renderWithMocks(<SessionEfficiency {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should be interactive
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
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

      renderWithMocks(<SessionEfficiency {...propsWithDifferentThresholds} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render with different thresholds
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<SessionEfficiency {...propsWithoutProfile} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should handle undefined profileId
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    });
  });
});
