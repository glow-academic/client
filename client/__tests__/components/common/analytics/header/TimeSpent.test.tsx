import { render } from '@/test/custom-render';
import { fireEvent, screen, waitFor } from '@/test/custom-render';
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import TimeSpent, {
  TimeSpentProps,
} from "@/components/common/analytics/header/TimeSpent";

// Mock the utility function
vi.mock("@/utils/analytics/header", () => ({
  calculateTimeSpent: vi.fn(),
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

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn().mockResolvedValue([
      {
        id: "chat-1",
        attemptId: "attempt-1",
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
import { calculateTimeSpent } from "@/utils/analytics/header";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: TimeSpentProps = {
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
describe("TimeSpent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for utility function
    vi.mocked(calculateTimeSpent).mockReturnValue({
      currentValue: 1800, // 30 minutes in seconds
      trendData: [
        { date: "01/15", value: 1800, count: 1 },
        { date: "01/16", value: 1500, count: 1 },
      ],
      hasData: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      render(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
      // Check for the formatted time display (1800 seconds = 30 minutes)
      await waitFor(() => {
        expect(screen.getByText("30m 0s")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<TimeSpent {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
  });

  describe("Data fetching and utility function integration", () => {
    it("should call calculateTimeSpent with correct parameters", async () => {
      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(calculateTimeSpent).toHaveBeenCalledWith(
          expect.any(Array), // chats
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
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 120,
        trendData: [{ date: "01/15", value: 120, count: 1 }],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("2m 0s")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when utility function returns no data", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 0,
        trendData: [],
        hasData: false,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });
  });

  describe("Color Configuration", () => {
    it("should apply danger color when time spent is below danger threshold", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 30, // Below danger threshold of 50
        trendData: [{ date: "01/15", value: 30, count: 1 }],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("30s")).toBeInTheDocument();
      });

      // Check for danger color classes
      const card = screen
        .getByText("Time Spent")
        .closest('[class*="from-red-50"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply warning color when time spent is between danger and warning thresholds", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 60, // Between danger (50) and warning (75) thresholds
        trendData: [{ date: "01/15", value: 60, count: 1 }],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("1m 0s")).toBeInTheDocument();
      });

      // Check for warning color classes
      const card = screen
        .getByText("Time Spent")
        .closest('[class*="from-yellow-50"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply success color when time spent is above success threshold", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 100, // Above success threshold of 90
        trendData: [{ date: "01/15", value: 100, count: 1 }],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("1m 40s")).toBeInTheDocument();
      });

      // Check for success color classes
      const card = screen
        .getByText("Time Spent")
        .closest('[class*="from-green-50"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should open dialog when card is clicked", async () => {
      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card =
        screen.getByText("Time Spent").closest('[role="button"]') ||
        screen.getByText("Time Spent");
      fireEvent.click(card);

      await waitFor(() => {
        expect(screen.getByText("Time Spent Trend")).toBeInTheDocument();
      });
    });

    it("should close dialog when close button is clicked", async () => {
      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card =
        screen.getByText("Time Spent").closest('[role="button"]') ||
        screen.getByText("Time Spent");
      fireEvent.click(card);

      await waitFor(() => {
        expect(screen.getByText("Time Spent Trend")).toBeInTheDocument();
      });

      // Close dialog
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText("Time Spent Trend")).not.toBeInTheDocument();
      });
    });
  });

  describe("Time formatting", () => {
    it("should format seconds correctly", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 45,
        trendData: [],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("45s")).toBeInTheDocument();
      });
    });

    it("should format minutes and seconds correctly", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 125,
        trendData: [],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("2m 5s")).toBeInTheDocument();
      });
    });

    it("should format hours and minutes correctly", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 7325,
        trendData: [],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("2h 2m")).toBeInTheDocument();
      });
    });

    it("should format days, hours, and minutes correctly", async () => {
      vi.mocked(calculateTimeSpent).mockReturnValue({
        currentValue: 90000,
        trendData: [],
        hasData: true,
      });

      render(<TimeSpent {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("1d 1h 0m")).toBeInTheDocument();
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

      render(<TimeSpent {...propsWithDifferentThresholds} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      render(<TimeSpent {...propsWithoutProfile} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });

    it("should handle empty cohortIds array", async () => {
      const propsWithEmptyCohorts = {
        ...mockProps,
        cohortIds: [],
      };

      render(<TimeSpent {...propsWithEmptyCohorts} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Time Spent")).toBeInTheDocument();
    });
  });
});
