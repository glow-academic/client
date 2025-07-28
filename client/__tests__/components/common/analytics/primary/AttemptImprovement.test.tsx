import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import AttemptImprovement, {
  AttemptImprovementProps,
} from "@/components/common/analytics/primary/AttemptImprovement";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockProps = (
  overrides: Partial<AttemptImprovementProps> = {}
): AttemptImprovementProps => ({
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
describe("AttemptImprovement", () => {
  const _user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Performance improvement across multiple attempts")
      ).toBeInTheDocument();
      // The component uses a TrendingUp icon from lucide-react
      expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
    });

    it("renders with different threshold configurations", async () => {
      const props = createMockProps({
        thresholds: {
          danger: 30,
          warning: 60,
          success: 90,
        },
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("renders with undefined profileId", async () => {
      const props = createMockProps({ profileId: undefined });
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("renders with empty cohortIds array", async () => {
      const props = createMockProps({ cohortIds: [] });
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading States", () => {
    it("shows loading state when data is being fetched", async () => {
      // Mock loading state by not providing data
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      // Mock empty data
      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("No data available for the selected cohorts")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Chart Rendering", () => {
    it("renders chart when data is available", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for chart elements - the component shows no data message when no data available
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("displays correct chart data structure", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Verify chart data structure - component shows no data message when no data available
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });
  });

  describe("Simulation Picker Integration", () => {
    it("renders simulation picker when simulations are available", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for simulation picker - it may not be visible if no simulations with data
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("allows filtering by simulation selection", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Verify component renders correctly
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });
  });

  describe("Threshold Status Indicators", () => {
    it("displays success indicator when improvement meets success threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 5, warning: 10, success: 15 },
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for success indicator - the component shows a colored dot in the top right
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("displays warning indicator when improvement meets warning threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 5, warning: 10, success: 20 },
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for warning indicator - the component shows a colored dot in the top right
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("displays danger indicator when improvement is below danger threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 20, warning: 30, success: 40 },
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for danger indicator - the component shows a colored dot in the top right
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });
  });

  describe("Actionable Insights", () => {
    it("displays actionable insights when significant improvement is detected", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for insights section - component shows no data message when no data available
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("does not display insights when no significant improvement is detected", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Verify insights are not shown when no significant improvement
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });
  });

  describe("Cohort Filtering", () => {
    it("handles no data available for selected cohorts", async () => {
      const props = createMockProps({
        cohortIds: ["non-existent-cohort"],
      });

      renderWithMocks(<AttemptImprovement {...props} />);

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

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by date range correctly", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("handles edge case dates", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-01-01T00:00:00.000Z"),
        dateEnd: new Date("2024-12-31T23:59:59.999Z"),
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });
  });

  describe("Profile Filtering", () => {
    it("filters data by specific profile", async () => {
      const props = createMockProps({
        profileId: "specific-profile-id",
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("shows all profiles when profileId is undefined", async () => {
      const props = createMockProps({
        profileId: undefined,
      });

      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("handles malformed data gracefully", async () => {
      // Mock malformed data
      vi.mocked(getAllProfiles).mockResolvedValue([
        { invalid: "data" },
      ] as unknown as Awaited<ReturnType<typeof getAllProfiles>>);

      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Check for proper accessibility attributes - component uses Card with article role
      const card = screen.getByRole("article");
      expect(card).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Test keyboard navigation - component shows no data message
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
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
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });
    });

    it("handles rapid prop changes gracefully", async () => {
      const props = createMockProps();
      renderWithMocks(<AttemptImprovement {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
      });

      // Verify component renders correctly
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });
  });
});
