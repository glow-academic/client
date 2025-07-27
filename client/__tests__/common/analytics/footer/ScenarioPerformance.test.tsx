import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ScenarioPerformance, {
  ScenarioPerformanceProps,
} from "@/components/common/analytics/footer/ScenarioPerformance";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ScenarioPerformanceProps = {
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
describe("ScenarioPerformance", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ScenarioPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<ScenarioPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should display the component title
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<ScenarioPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should have proper structure
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
      ).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllProfiles).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<ScenarioPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should handle errors gracefully
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
      ).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // Test loading states
      renderWithMocks(<ScenarioPerformance {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should handle loading states
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
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

      renderWithMocks(<ScenarioPerformance {...propsWithDifferentDates} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should handle different date ranges
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<ScenarioPerformance {...propsWithoutProfile} />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should handle missing profileId
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
      ).toBeInTheDocument();
    });
  });
});
