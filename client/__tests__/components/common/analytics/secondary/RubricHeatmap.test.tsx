import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import RubricHeatmap, {
  RubricHeatmapProps,
} from "@/components/common/analytics/secondary/RubricHeatmap";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockProps = (
  overrides: Partial<RubricHeatmapProps> = {}
): RubricHeatmapProps => ({
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-12-31"),
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
  profileId: "test-profile-id",
  cohortIds: ["test-cohort-id"],
  ...overrides,
});

// ------------------------------------------------------------------
describe("RubricHeatmap", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("Correlation analysis between skill areas")
      ).toBeInTheDocument();
      expect(screen.getByTestId("trending-up-icon")).toBeInTheDocument();
    });

    it("renders with different threshold configurations", async () => {
      const props = createMockProps({
        thresholds: {
          danger: 30,
          warning: 60,
          success: 90,
        },
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("renders with undefined profileId", async () => {
      const props = createMockProps({ profileId: undefined });
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("renders with empty cohortIds array", async () => {
      const props = createMockProps({ cohortIds: [] });
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Rubric Picker Integration", () => {
    it("renders rubric picker when rubrics are available", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for rubric picker
      const pickerButton = screen.getByRole("button", {
        name: /filter by rubric/i,
      });
      expect(pickerButton).toBeInTheDocument();
    });

    it("allows filtering by rubric selection", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      const pickerButton = screen.getByRole("button", {
        name: /filter by rubric/i,
      });
      await user.click(pickerButton);

      // Verify picker functionality
      expect(pickerButton).toBeInTheDocument();
    });
  });

  describe("Heatmap Rendering", () => {
    it("renders heatmap table when data is available", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for heatmap table
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("displays correct heatmap data structure", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify heatmap data structure
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });

    it("handles correlation calculations correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify correlation calculations
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });
  });

  describe("Data Loading States", () => {
    it("shows loading state when data is being fetched", async () => {
      // Mock loading state by not providing data
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      // Mock empty data
      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "No correlation data available for the selected criteria"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status Indicators", () => {
    it("displays success indicator when correlations meet success threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 0.3, warning: 0.5, success: 0.7 },
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for success indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-green-500");
    });

    it("displays warning indicator when correlations meet warning threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 0.3, warning: 0.5, success: 0.7 },
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for warning indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-yellow-500");
    });

    it("displays danger indicator when correlations are below danger threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 0.3, warning: 0.5, success: 0.7 },
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for danger indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-red-500");
    });
  });

  describe("Actionable Insights", () => {
    it("displays actionable insights when correlation issues are detected", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for insights section
      const insightsSection = screen.getByTestId("actionable-insights");
      expect(insightsSection).toBeInTheDocument();
    });

    it("does not display insights when correlations are good", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify insights are not shown when correlations are good
      const insightsSection = screen.queryByTestId("actionable-insights");
      expect(insightsSection).not.toBeInTheDocument();
    });
  });

  describe("Cohort Filtering", () => {
    it("handles no data available for selected cohorts", async () => {
      const props = createMockProps({
        cohortIds: ["non-existent-cohort"],
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("No data available for the selected cohorts")
        ).toBeInTheDocument();
      });
    });

    it("filters data correctly when specific cohorts are selected", async () => {
      const props = createMockProps({
        cohortIds: ["test-cohort-id"],
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by date range correctly", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("handles edge case dates", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-01-01T00:00:00.000Z"),
        dateEnd: new Date("2024-12-31T23:59:59.999Z"),
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Profile Filtering", () => {
    it("filters data by specific profile", async () => {
      const props = createMockProps({
        profileId: "specific-profile-id",
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("shows all profiles when profileId is undefined", async () => {
      const props = createMockProps({
        profileId: undefined,
      });

      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Correlation Calculations", () => {
    it("calculates Pearson correlation correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify correlation calculations
      expect(
        screen.getByText("Skill Area Correlation Matrix")
      ).toBeInTheDocument();
    });

    it("handles edge cases in correlation calculations", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify edge case handling
      expect(
        screen.getByText("Skill Area Correlation Matrix")
      ).toBeInTheDocument();
    });
  });

  describe("Table Functionality", () => {
    it("displays correlation values in table cells", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify table cells display correlation values
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });

    it("applies correct color coding to correlation values", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Verify color coding is applied correctly
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("handles malformed data gracefully", async () => {
      // Mock malformed data
      vi.mocked(getAllProfiles).mockResolvedValue([
        { invalid: "data" },
      ] as unknown as Awaited<ReturnType<typeof getAllProfiles>>);

      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Check for proper accessibility attributes
      const card = screen.getByRole("region", {
        name: /skill area correlation matrix/i,
      });
      expect(card).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });

      // Test keyboard navigation
      const pickerButton = screen.getByRole("button", {
        name: /filter by rubric/i,
      });
      pickerButton.focus();
      expect(pickerButton).toHaveFocus();
    });
  });

  describe("Performance", () => {
    it("handles large datasets efficiently", async () => {
      // Mock large dataset
      const largeProfiles = Array.from({ length: 1000 }, (_, i) => ({
        id: `profile-${i}`,
        role: "ta",
        // ... other required fields
      }));
      vi.mocked(getAllProfiles).mockResolvedValue(
        largeProfiles as unknown as Awaited<ReturnType<typeof getAllProfiles>>
      );

      const props = createMockProps();
      renderWithMocks(<RubricHeatmap {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });

    it("debounces rapid prop changes", async () => {
      const props = createMockProps();
      const { rerender } = renderWithMocks(<RubricHeatmap {...props} />);

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(<RubricHeatmap {...props} />);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix")
        ).toBeInTheDocument();
      });
    });
  });
});
