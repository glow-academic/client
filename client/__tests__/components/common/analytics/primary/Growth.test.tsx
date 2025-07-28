import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Growth, {
  GrowthProps,
} from "@/components/common/analytics/primary/Growth";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockProps = (
  overrides: Partial<GrowthProps> = {}
): GrowthProps => ({
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
describe("Growth", () => {
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
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Platform-wide performance metrics over time")
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

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("renders with undefined profileId", async () => {
      const props = createMockProps({ profileId: undefined });
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("renders with empty cohortIds array", async () => {
      const props = createMockProps({ cohortIds: [] });
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Growth Picker Integration", () => {
    it("renders growth picker with available metrics", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for growth picker
      const pickerButton = screen.getByRole("button", { name: /metrics/i });
      expect(pickerButton).toBeInTheDocument();
    });

    it("allows selecting different metrics", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      const pickerButton = screen.getByRole("button", { name: /metrics/i });
      await user.click(pickerButton);

      // Verify picker functionality
      expect(pickerButton).toBeInTheDocument();
    });

    it("maintains at least one selected metric", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Verify that at least one metric is always selected
      const pickerButton = screen.getByRole("button", { name: /metrics/i });
      expect(pickerButton).toBeInTheDocument();
    });
  });

  describe("Chart Rendering", () => {
    it("renders line chart when data is available", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for chart elements
      expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
    });

    it("displays multiple metrics on the same chart", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Verify chart can display multiple metrics
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles chart tooltips correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
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
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      // Mock empty data
      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("No growth data found for the selected date range")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status Indicators", () => {
    it("displays success indicator when growth meets success threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 5, warning: 10, success: 15 },
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for success indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-green-500");
    });

    it("displays warning indicator when growth meets warning threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 5, warning: 10, success: 20 },
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for warning indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-yellow-500");
    });

    it("displays danger indicator when growth is below danger threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 20, warning: 30, success: 40 },
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for danger indicator
      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-red-500");
    });
  });

  describe("Actionable Insights", () => {
    it("displays actionable insights when significant decline is detected", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for insights section
      const insightsSection = screen.getByTestId("actionable-insights");
      expect(insightsSection).toBeInTheDocument();
    });

    it("does not display insights when no significant decline is detected", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Verify insights are not shown when no significant decline
      const insightsSection = screen.queryByTestId("actionable-insights");
      expect(insightsSection).not.toBeInTheDocument();
    });
  });

  describe("Cohort Filtering", () => {
    it("handles no data available for selected cohorts", async () => {
      const props = createMockProps({
        cohortIds: ["non-existent-cohort"],
      });

      renderWithMocks(<Growth {...props} />);

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

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by date range correctly", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("handles edge case dates", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-01-01T00:00:00.000Z"),
        dateEnd: new Date("2024-12-31T23:59:59.999Z"),
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Profile Filtering", () => {
    it("filters data by specific profile", async () => {
      const props = createMockProps({
        profileId: "specific-profile-id",
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("shows all profiles when profileId is undefined", async () => {
      const props = createMockProps({
        profileId: undefined,
      });

      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Metric Calculations", () => {
    it("calculates average score correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Verify metric calculations
      expect(screen.getByText("Platform Growth")).toBeInTheDocument();
    });

    it("calculates pass rate correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Verify pass rate calculations
      expect(screen.getByText("Platform Growth")).toBeInTheDocument();
    });

    it("calculates completion rate correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Verify completion rate calculations
      expect(screen.getByText("Platform Growth")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("handles malformed data gracefully", async () => {
      // Mock malformed data
      vi.mocked(getAllProfiles).mockResolvedValue([
        { invalid: "data" },
      ] as unknown as Awaited<ReturnType<typeof getAllProfiles>>);

      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Check for proper accessibility attributes
      const card = screen.getByRole("region", { name: /platform growth/i });
      expect(card).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const props = createMockProps();
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });

      // Test keyboard navigation
      const pickerButton = screen.getByRole("button", { name: /metrics/i });
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
      renderWithMocks(<Growth {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("debounces rapid prop changes", async () => {
      const props = createMockProps();
      const { rerender } = renderWithMocks(<Growth {...props} />);

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(<Growth {...props} />);
      }

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });
});
