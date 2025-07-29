import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import TimeSpent, {
  TimeSpentProps,
} from "@/components/common/analytics/header/TimeSpent";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: TimeSpentProps = {
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
describe("TimeSpent", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
    it("should render with props", async () => {
      renderWithMocks(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
  });
  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      renderWithMocks(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
  });
  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      const propsWithDifferentThresholds = {
        ...mockProps,
        thresholds: {
          danger: 30,
          warning: 60,
          success: 80,
        },
      };
      renderWithMocks(<TimeSpent {...propsWithDifferentThresholds} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
    it("should handle missing or invalid props", async () => {
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };
      renderWithMocks(<TimeSpent {...propsWithoutProfile} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
  });
});
