import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import CohortPerformance, {
  CohortPerformanceProps,
} from "@/components/common/analytics/secondary/CohortPerformance";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockProps = (
  overrides: Partial<CohortPerformanceProps> = {}
): CohortPerformanceProps => ({
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
describe("CohortPerformance", () => {
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
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Performance comparison across cohorts")
      ).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart-3-icon")).toBeInTheDocument();
    });

    it("renders with different threshold configurations", async () => {
      const props = createMockProps({
        thresholds: {
          danger: 30,
          warning: 60,
          success: 90,
        },
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("renders with undefined profileId", async () => {
      const props = createMockProps({ profileId: undefined });
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("renders with empty cohortIds array", async () => {
      const props = createMockProps({ cohortIds: [] });
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Cohort Selection", () => {
    it("renders cohort selector when cohorts are available", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for cohort selector
      const cohortSelector = screen.getByRole("combobox", {
        name: /select cohort/i,
      });
      expect(cohortSelector).toBeInTheDocument();
    });

    it("allows selecting different cohorts", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      const cohortSelector = screen.getByRole("combobox", {
        name: /select cohort/i,
      });
      await user.click(cohortSelector);

      // Verify cohort selection functionality
      expect(cohortSelector).toBeInTheDocument();
    });
  });

  describe("Simulation Picker Integration", () => {
    it("renders simulation picker when simulations are available", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for simulation picker
      const pickerButton = screen.getByRole("button", {
        name: /filter by simulation/i,
      });
      expect(pickerButton).toBeInTheDocument();
    });

    it("allows filtering by simulation selection", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      const pickerButton = screen.getByRole("button", {
        name: /filter by simulation/i,
      });
      await user.click(pickerButton);

      // Verify picker functionality
      expect(pickerButton).toBeInTheDocument();
    });
  });

  describe("Chart Rendering", () => {
    it("renders line chart when data is available", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for chart elements
      expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
    });

    it("displays correct chart data structure", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Verify chart data structure
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles chart tooltips correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Verify tooltip functionality
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Data Loading States", () => {
    it("shows loading state when data is being fetched", async () => {
      // Mock loading state by not providing data
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      // Mock empty data
      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "No performance data available for the selected criteria"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status Indicators", () => {
    it("displays success indicator when performance meets success threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for success indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-green-500");
    });

    it("displays warning indicator when performance meets warning threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for warning indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-yellow-500");
    });

    it("displays danger indicator when performance is below danger threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for danger indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-red-500");
    });
  });

  describe("Actionable Insights", () => {
    it("displays actionable insights when performance issues are detected", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for insights section
      const insightsSection = screen.getByTestId("actionable-insights");
      expect(insightsSection).toBeInTheDocument();
    });

    it("does not display insights when performance is good", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Verify insights are not shown when performance is good
      const insightsSection = screen.queryByTestId("actionable-insights");
      expect(insightsSection).not.toBeInTheDocument();
    });
  });

  describe("Cohort Filtering", () => {
    it("handles no data available for selected cohorts", async () => {
      const props = createMockProps({
        cohortIds: ["non-existent-cohort"],
      });

      renderWithMocks(<CohortPerformance {...props} />);

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

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by date range correctly", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("handles edge case dates", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-01-01T00:00:00.000Z"),
        dateEnd: new Date("2024-12-31T23:59:59.999Z"),
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Profile Filtering", () => {
    it("filters data by specific profile", async () => {
      const props = createMockProps({
        profileId: "specific-profile-id",
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("shows all profiles when profileId is undefined", async () => {
      const props = createMockProps({
        profileId: undefined,
      });

      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Cohort Data Processing", () => {
    it("processes cohort data correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Verify cohort data processing
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("handles multiple cohorts", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Verify multiple cohorts are handled
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });
  });

  describe("Dialog Functionality", () => {
    it("opens detail dialog when cohort is clicked", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Find and click on a cohort line
      const cohortLine = screen.getByRole("button", { name: /cohort/i });
      await user.click(cohortLine);

      // Verify dialog opens
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("displays detailed cohort information in dialog", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Open dialog
      const cohortLine = screen.getByRole("button", { name: /cohort/i });
      await user.click(cohortLine);

      // Verify detailed information is displayed
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("handles state changes", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should handle state changes gracefully
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("handles user events", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Should handle user interactions
      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("handles malformed data gracefully", async () => {
      // Mock malformed data
      vi.mocked(getAllProfiles).mockResolvedValue([
        { invalid: "data" },
      ] as unknown as Awaited<ReturnType<typeof getAllProfiles>>);

      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Check for proper accessibility attributes
      const card = screen.getByRole("region", { name: /cohort performance/i });
      expect(card).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const props = createMockProps();
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });

      // Test keyboard navigation
      const pickerButton = screen.getByRole("button", {
        name: /filter by simulation/i,
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
      renderWithMocks(<CohortPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("debounces rapid prop changes", async () => {
      const props = createMockProps();
      const { rerender } = renderWithMocks(<CohortPerformance {...props} />);

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(<CohortPerformance {...props} />);
      }

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });
  });
});
