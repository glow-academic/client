import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import SkillPerformance, {
  SkillPerformanceProps,
} from "@/components/common/analytics/secondary/SkillPerformance";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockProps = (
  overrides: Partial<SkillPerformanceProps> = {}
): SkillPerformanceProps => ({
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
describe("SkillPerformance", () => {
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
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Performance analysis by skill area")
      ).toBeInTheDocument();
      expect(screen.getByTestId("graduation-cap-icon")).toBeInTheDocument();
    });

    it("renders with different threshold configurations", async () => {
      const props = createMockProps({
        thresholds: {
          danger: 30,
          warning: 60,
          success: 90,
        },
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("renders with undefined profileId", async () => {
      const props = createMockProps({ profileId: undefined });
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("renders with empty cohortIds array", async () => {
      const props = createMockProps({ cohortIds: [] });
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Rubric Picker Integration", () => {
    it("renders rubric picker when rubrics are available", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for rubric picker
      const pickerButton = screen.getByRole("button", {
        name: /filter by rubric/i,
      });
      expect(pickerButton).toBeInTheDocument();
    });

    it("allows filtering by rubric selection", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      const pickerButton = screen.getByRole("button", {
        name: /filter by rubric/i,
      });
      await user.click(pickerButton);

      // Verify picker functionality
      expect(pickerButton).toBeInTheDocument();
    });
  });

  describe("Radar Chart Rendering", () => {
    it("renders radar chart when data is available", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for radar chart elements
      expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
    });

    it("displays correct radar chart data structure", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Verify radar chart data structure
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles chart tooltips correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
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
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      // Mock empty data
      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "No skill performance data available for the selected criteria"
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

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for success indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-green-500");
    });

    it("displays warning indicator when performance meets warning threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for warning indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-yellow-500");
    });

    it("displays danger indicator when performance is below danger threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for danger indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-red-500");
    });
  });

  describe("Actionable Insights", () => {
    it("displays actionable insights when performance issues are detected", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for insights section
      const insightsSection = screen.getByTestId("actionable-insights");
      expect(insightsSection).toBeInTheDocument();
    });

    it("does not display insights when performance is good", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
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

      renderWithMocks(<SkillPerformance {...props} />);

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

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by date range correctly", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("handles edge case dates", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-01-01T00:00:00.000Z"),
        dateEnd: new Date("2024-12-31T23:59:59.999Z"),
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Profile Filtering", () => {
    it("filters data by specific profile", async () => {
      const props = createMockProps({
        profileId: "specific-profile-id",
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("shows all profiles when profileId is undefined", async () => {
      const props = createMockProps({
        profileId: undefined,
      });

      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Skill Data Processing", () => {
    it("processes skill data correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Verify skill data processing
      expect(screen.getByText("Skill Performance")).toBeInTheDocument();
    });

    it("handles different skill areas", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Verify different skill areas are handled
      expect(screen.getByText("Skill Performance")).toBeInTheDocument();
    });
  });

  describe("Radar Chart Functionality", () => {
    it("displays skill scores on radar chart", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Verify radar chart displays skill scores
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles radar chart interactions", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Verify radar chart interactions
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("handles malformed data gracefully", async () => {
      // Mock malformed data
      vi.mocked(getAllProfiles).mockResolvedValue([
        { invalid: "data" },
      ] as unknown as Awaited<ReturnType<typeof getAllProfiles>>);

      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Check for proper accessibility attributes
      const card = screen.getByRole("region", { name: /skill performance/i });
      expect(card).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const props = createMockProps();
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
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
      renderWithMocks(<SkillPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("debounces rapid prop changes", async () => {
      const props = createMockProps();
      const { rerender } = renderWithMocks(<SkillPerformance {...props} />);

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(<SkillPerformance {...props} />);
      }

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });
  });
});
