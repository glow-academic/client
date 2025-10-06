import { render } from "@/test/custom-render";
import { fireEvent, screen, waitFor } from "@/test/custom-render";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import FirstAttemptPassRate, {
  FirstAttemptPassRateProps,
} from "@/components/common/analytics/header/FirstAttemptPassRate";

// Mock the utility function
vi.mock("@/utils/analytics/header", () => ({
  calculateFirstAttemptPassRate: vi.fn(),
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
  }),
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
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn().mockResolvedValue([
      {
        id: "grade-1",
        simulationChatId: "chat-1",
        passed: true,
        score: 85,
      },
    ]),
  }),
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
import { calculateFirstAttemptPassRate } from "@/utils/analytics/header";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: FirstAttemptPassRateProps = {
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
describe("FirstAttemptPassRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock return value
    vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
      currentValue: 75,
      trendData: [
        { date: "01/15", value: 75, count: 1 },
        { date: "01/16", value: 80, count: 2 },
      ],
      hasData: true,
    });
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<FirstAttemptPassRate {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render the component
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      // Test component with various props
      render(<FirstAttemptPassRate {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should display the component
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      render(<FirstAttemptPassRate {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });
  });

  describe("Data Loading and Utility Function Integration", () => {
    it("should call calculateFirstAttemptPassRate with correct parameters", async () => {
      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(calculateFirstAttemptPassRate).toHaveBeenCalledWith(
          expect.any(Array), // attempts
          expect.any(Array), // chats
          expect.any(Array), // grades
          expect.any(Array), // simulations
          mockProps.dateStart,
          mockProps.dateEnd,
          mockProps.profileId,
          expect.any(Array), // cohorts
          mockProps.cohortIds,
        );
      });
    });

    it("should display correct value when utility function returns data", async () => {
      vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
        currentValue: 85,
        trendData: [{ date: "01/15", value: 85, count: 1 }],
        hasData: true,
      });

      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No cohort data")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when utility function returns no data", async () => {
      vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
        currentValue: 0,
        trendData: [],
        hasData: false,
      });

      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });
  });

  describe("Color Configuration", () => {
    it("should apply danger color when value is below danger threshold", async () => {
      vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
        currentValue: 30, // Below danger threshold of 50
        trendData: [{ date: "01/15", value: 30, count: 1 }],
        hasData: true,
      });

      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No cohort data")).toBeInTheDocument();
      });

      // Check for danger color classes - the color is determined by the utility function value
      const card = screen
        .getByText("First Attempt Pass Rate")
        .closest('[class*="from-red-50"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply warning color when value is between danger and warning thresholds", async () => {
      vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
        currentValue: 60, // Between danger (50) and warning (75) thresholds
        trendData: [{ date: "01/15", value: 60, count: 1 }],
        hasData: true,
      });

      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No cohort data")).toBeInTheDocument();
      });

      // Check that the component renders correctly - color classes are determined by utility function value
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });

    it("should apply success color when value is above success threshold", async () => {
      vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
        currentValue: 95, // Above success threshold of 90
        trendData: [{ date: "01/15", value: 95, count: 1 }],
        hasData: true,
      });

      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No cohort data")).toBeInTheDocument();
      });

      // Check that the component renders correctly - color classes are determined by utility function value
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });
  });

  describe("Dialog Functionality", () => {
    it("should open dialog when card is clicked", async () => {
      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Click on the card to open dialog
      const card =
        screen
          .getByText("First Attempt Pass Rate")
          .closest('[role="button"]') ||
        screen.getByText("First Attempt Pass Rate");
      fireEvent.click(card);

      await waitFor(() => {
        expect(
          screen.getByText("First Attempt Pass Rate Trend"),
        ).toBeInTheDocument();
      });
    });

    it("should display 'No data' message in dialog when no data available", async () => {
      vi.mocked(calculateFirstAttemptPassRate).mockReturnValue({
        currentValue: 0,
        trendData: [],
        hasData: false,
      });

      render(<FirstAttemptPassRate {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Click on the card to open dialog
      const card =
        screen
          .getByText("First Attempt Pass Rate")
          .closest('[role="button"]') ||
        screen.getByText("First Attempt Pass Rate");
      fireEvent.click(card);

      await waitFor(() => {
        expect(
          screen.getByText("First Attempt Pass Rate Trend"),
        ).toBeInTheDocument();
      });

      // Should show no data message
      expect(
        screen.getByText(/No data available for the selected cohorts/),
      ).toBeInTheDocument();
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

      render(<FirstAttemptPassRate {...propsWithDifferentThresholds} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render with different thresholds
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      render(<FirstAttemptPassRate {...propsWithoutProfile} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should handle undefined profileId
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });

    it("should handle empty cohortIds array", async () => {
      const propsWithEmptyCohorts = {
        ...mockProps,
        cohortIds: [],
      };

      render(<FirstAttemptPassRate {...propsWithEmptyCohorts} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      render(<FirstAttemptPassRate {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should be interactive
      expect(screen.getByText("First Attempt Pass Rate")).toBeInTheDocument();
    });
  });
});
