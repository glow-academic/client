import { renderWithMocks } from "@/test/renderWithMocks";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import TotalAttempts, {
  TotalAttemptsProps,
} from "@/components/common/analytics/header/TotalAttempts";

// Mock the utility function
vi.mock("@/utils/analytics/header", () => ({
  calculateTotalAttempts: vi.fn(),
}));

// Mock the queries with proper default exports
vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi
    .fn()
    .mockResolvedValue([{ id: "test-profile-id", name: "Test Profile" }]),
}));

vi.mock("@/utils/queries/cohorts/get-all-cohorts", () => ({
  getAllCohorts: vi.fn().mockResolvedValue([
    {
      id: "test-cohort-id",
      title: "Test Cohort",
      profileIds: ["test-profile-id"],
      simulationIds: ["sim-1", "sim-2"],
      active: true, // Add active property
    },
  ]),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
  () => ({
    getSimulationAttemptsByProfiles: vi.fn().mockResolvedValue([
      {
        id: "attempt-1",
        profileId: "test-profile-id",
        simulationId: "sim-1",
        createdAt: "2024-01-15T10:00:00Z",
      },
    ]),
  })
);

vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn().mockResolvedValue([
    {
      id: "sim-1",
      title: "Test Simulation",
      practiceSimulation: false,
    },
  ]),
}));

// Import the mocked function
import { calculateTotalAttempts } from "@/utils/analytics/header";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: TotalAttemptsProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-01-31"),
  thresholds: {
    danger: 50,
    warning: 75,
    success: 90,
  },
  profileId: "test-profile-id",
  cohortIds: ["test-cohort-id"],
};

// ------------------------------------------------------------------
describe("TotalAttempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for utility function
    vi.mocked(calculateTotalAttempts).mockReturnValue({
      currentValue: 3,
      trendData: [
        { date: "01/15", value: 1, count: 1 },
        { date: "01/16", value: 1, count: 1 },
        { date: "01/17", value: 1, count: 1 },
      ],
      hasData: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<TotalAttempts {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      renderWithMocks(<TotalAttempts {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Total Attempts")).toBeInTheDocument();
      // Check for the formatted attempts display
      await waitFor(() => {
        expect(screen.getByText("3")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<TotalAttempts {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    });
  });

  describe("Data fetching and utility function integration", () => {
    it("should call calculateTotalAttempts with correct parameters", async () => {
      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(calculateTotalAttempts).toHaveBeenCalledWith(
          expect.any(Array), // attempts
          expect.any(Array), // simulations
          mockProps.dateStart,
          mockProps.dateEnd,
          mockProps.profileId,
          expect.any(Array), // cohorts
          mockProps.cohortIds
        );
      });
    });

    it("should display correct value when utility function returns data", async () => {
      vi.mocked(calculateTotalAttempts).mockReturnValue({
        currentValue: 5,
        trendData: [{ date: "01/15", value: 5, count: 1 }],
        hasData: true,
      });

      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("5")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when utility function returns no data", async () => {
      vi.mocked(calculateTotalAttempts).mockReturnValue({
        currentValue: 0,
        trendData: [],
        hasData: false,
      });

      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });
  });

  describe("Color Configuration", () => {
    it("should apply danger color when attempts are below danger threshold", async () => {
      vi.mocked(calculateTotalAttempts).mockReturnValue({
        currentValue: 30, // Below danger threshold of 50
        trendData: [{ date: "01/15", value: 30, count: 1 }],
        hasData: true,
      });

      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("30")).toBeInTheDocument();
      });

      // Check for danger color classes
      const card = screen
        .getByText("Total Attempts")
        .closest('[class*="from-red-50"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply warning color when attempts are between danger and warning thresholds", async () => {
      vi.mocked(calculateTotalAttempts).mockReturnValue({
        currentValue: 60, // Between danger (50) and warning (75) thresholds
        trendData: [{ date: "01/15", value: 60, count: 1 }],
        hasData: true,
      });

      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("60")).toBeInTheDocument();
      });

      // Check for warning color classes
      const card = screen
        .getByText("Total Attempts")
        .closest('[class*="from-yellow-50"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply success color when attempts are above success threshold", async () => {
      vi.mocked(calculateTotalAttempts).mockReturnValue({
        currentValue: 100, // Above success threshold of 90
        trendData: [{ date: "01/15", value: 100, count: 1 }],
        hasData: true,
      });

      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });

      // Check for success color classes
      const card = screen
        .getByText("Total Attempts")
        .closest('[class*="from-green-50"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should open dialog when card is clicked", async () => {
      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card =
        screen.getByText("Total Attempts").closest('[role="button"]') ||
        screen.getByText("Total Attempts");
      fireEvent.click(card);

      await waitFor(() => {
        expect(screen.getByText("Total Attempts Trend")).toBeInTheDocument();
      });
    });

    it("should close dialog when close button is clicked", async () => {
      renderWithMocks(<TotalAttempts {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card =
        screen.getByText("Total Attempts").closest('[role="button"]') ||
        screen.getByText("Total Attempts");
      fireEvent.click(card);

      await waitFor(() => {
        expect(screen.getByText("Total Attempts Trend")).toBeInTheDocument();
      });

      // Close dialog
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Total Attempts Trend")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different thresholds
      const propsWithDifferentThresholds = {
        ...mockProps,
        thresholds: {
          danger: 30,
          warning: 60,
          success: 80,
        },
      };

      renderWithMocks(<TotalAttempts {...propsWithDifferentThresholds} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<TotalAttempts {...propsWithoutProfile} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    });

    it("should handle empty cohortIds array", async () => {
      const propsWithEmptyCohorts = {
        ...mockProps,
        cohortIds: [],
      };

      renderWithMocks(<TotalAttempts {...propsWithEmptyCohorts} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    });
  });
});
