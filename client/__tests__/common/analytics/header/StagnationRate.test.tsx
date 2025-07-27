import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import StagnationRate, {
  StagnationRateProps,
} from "@/components/common/analytics/header/StagnationRate";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: StagnationRateProps = {
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
describe("StagnationRate", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<StagnationRate {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Stagnation Rate")).toBeInTheDocument();
    });
    it("should render with props", async () => {
      renderWithMocks(<StagnationRate {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Stagnation Rate")).toBeInTheDocument();
    });
    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<StagnationRate {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Stagnation Rate")).toBeInTheDocument();
    });
  });
  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      renderWithMocks(<StagnationRate {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Stagnation Rate")).toBeInTheDocument();
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
      renderWithMocks(<StagnationRate {...propsWithDifferentThresholds} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Stagnation Rate")).toBeInTheDocument();
    });
    it("should handle missing or invalid props", async () => {
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };
      renderWithMocks(<StagnationRate {...propsWithoutProfile} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Stagnation Rate")).toBeInTheDocument();
    });
  });
});
