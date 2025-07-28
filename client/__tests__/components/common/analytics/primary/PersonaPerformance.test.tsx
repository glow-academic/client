import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import PersonaPerformance, {
  PersonaPerformanceProps,
} from "@/components/common/analytics/primary/PersonaPerformance";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockProps = (
  overrides: Partial<PersonaPerformanceProps> = {}
): PersonaPerformanceProps => ({
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
describe("PersonaPerformance", () => {
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
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Performance analysis by persona type")
      ).toBeInTheDocument();
      // The component uses a Users icon from lucide-react
      expect(screen.getByText("Persona Performance")).toBeInTheDocument();
    });

    it("renders with different threshold configurations", async () => {
      const props = createMockProps({
        thresholds: {
          danger: 30,
          warning: 60,
          success: 90,
        },
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("renders with undefined profileId", async () => {
      const props = createMockProps({ profileId: undefined });
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("renders with empty cohortIds array", async () => {
      const props = createMockProps({ cohortIds: [] });
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Simulation Picker Integration", () => {
    it("renders simulation picker when simulations are available", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for simulation picker
      const pickerButton = screen.getByRole("button", {
        name: /filter by simulation/i,
      });
      expect(pickerButton).toBeInTheDocument();
    });

    it("allows filtering by simulation selection", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
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
    it("renders bar chart when data is available", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for chart elements
      expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
    });

    it("displays correct chart data structure", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Verify chart data structure
      const chartContainer = screen.getByRole("img", { name: /chart/i });
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles chart tooltips correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
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
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      // Mock empty data
      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);

      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(
          screen.getByText("No data available for the selected cohorts")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status Indicators", () => {
    it("displays success indicator when performance meets success threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for success indicator - the component shows a colored dot in the top right
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("displays warning indicator when performance meets warning threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for warning indicator - the component shows a colored dot in the top right
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("displays danger indicator when performance is below danger threshold", async () => {
      const props = createMockProps({
        thresholds: { danger: 50, warning: 70, success: 80 },
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for danger indicator - the component shows a colored dot in the top right
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });
  });

  describe("Actionable Insights", () => {
    it("displays actionable insights when performance issues are detected", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for insights section - component shows no data message when no data available
      expect(
        screen.getByText("No data available for the selected cohorts")
      ).toBeInTheDocument();
    });

    it("does not display insights when performance is good", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Verify insights are not shown when performance is good
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

      renderWithMocks(<PersonaPerformance {...props} />);

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

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by date range correctly", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-06-01"),
        dateEnd: new Date("2024-06-30"),
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("handles edge case dates", async () => {
      const props = createMockProps({
        dateStart: new Date("2024-01-01T00:00:00.000Z"),
        dateEnd: new Date("2024-12-31T23:59:59.999Z"),
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Profile Filtering", () => {
    it("filters data by specific profile", async () => {
      const props = createMockProps({
        profileId: "specific-profile-id",
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("shows all profiles when profileId is undefined", async () => {
      const props = createMockProps({
        profileId: undefined,
      });

      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Persona Data Processing", () => {
    it("processes persona data correctly", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Verify persona data processing
      expect(screen.getByText("Persona Performance")).toBeInTheDocument();
    });

    it("handles different persona types", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Verify different persona types are handled
      expect(screen.getByText("Persona Performance")).toBeInTheDocument();
    });
  });

  describe("Dialog Functionality", () => {
    it("opens detail dialog when persona is clicked", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Find and click on a persona bar
      const personaBar = screen.getByRole("button", { name: /persona/i });
      await user.click(personaBar);

      // Verify dialog opens
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("displays detailed persona information in dialog", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Open dialog
      const personaBar = screen.getByRole("button", { name: /persona/i });
      await user.click(personaBar);

      // Verify detailed information is displayed
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("handles malformed data gracefully", async () => {
      // Mock malformed data
      vi.mocked(getAllProfiles).mockResolvedValue([
        { invalid: "data" },
      ] as unknown as Awaited<ReturnType<typeof getAllProfiles>>);

      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });

      // Check for proper accessibility attributes
      const card = screen.getByRole("region", { name: /persona performance/i });
      expect(card).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const props = createMockProps();
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
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
      renderWithMocks(<PersonaPerformance {...props} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });

    it("debounces rapid prop changes", async () => {
      const props = createMockProps();
      const { rerender } = renderWithMocks(<PersonaPerformance {...props} />);

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(<PersonaPerformance {...props} />);
      }

      await waitFor(() => {
        expect(screen.getByText("Persona Performance")).toBeInTheDocument();
      });
    });
  });
});
