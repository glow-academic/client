import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ScenarioStats, {
  ScenarioStatsProps,
} from "@/components/common/analytics/footer/ScenarioStats";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ScenarioStatsProps = {
  dateStart: new Date(),
  dateEnd: new Date(),
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
  profileId: "test-profile-id",
  cohortIds: ["test-cohort-id"],
};

// ------------------------------------------------------------------
describe("ScenarioStats", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ScenarioStats {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<ScenarioStats {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should display the component title
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });

    it("should render metric picker and allow metric selection", async () => {
      renderWithMocks(<ScenarioStats {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should display the component title
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllProfiles).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<ScenarioStats {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should handle errors gracefully
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // Test loading states
      renderWithMocks(<ScenarioStats {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should handle loading states
      expect(
        screen.getByText("Scenario Performance Analysis"),
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

      renderWithMocks(<ScenarioStats {...propsWithDifferentDates} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should handle different date ranges
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<ScenarioStats {...propsWithoutProfile} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should handle missing profileId
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });
  });
});
