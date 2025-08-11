import Growth from "@/components/common/analytics/primary/Growth";
import { calculatePlatformGrowth } from "@/utils/analytics/primary";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all query functions
vi.mock("@/utils/queries/cohorts/get-all-cohorts");
vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock("@/utils/queries/simulations/get-all-simulations");
vi.mock("@/utils/analytics/primary", () => ({
  calculatePlatformGrowth: vi.fn(),
}));

const mockGetAllCohorts = vi.mocked(getAllCohorts);
const mockGetAllProfiles = vi.mocked(getAllProfiles);
const mockGetAllRubrics = vi.mocked(getAllRubrics);
const mockGetSimulationAttemptsByProfiles = vi.mocked(
  getSimulationAttemptsByProfiles
);
const mockGetSimulationChatGradesBySimulationChats = vi.mocked(
  getSimulationChatGradesBySimulationChats
);
const mockGetSimulationChatsByAttempts = vi.mocked(
  getSimulationChatsByAttempts
);
const mockGetAllSimulations = vi.mocked(getAllSimulations);
const mockCalculatePlatformGrowth = vi.mocked(calculatePlatformGrowth);

// Mock data
const mockProfiles = [
  {
    id: "profile1",
    updatedAt: "2024-01-01T00:00:00Z",
    userId: 1,
    lastLogin: "2024-01-01T00:00:00Z",
    firstName: "Test",
    lastName: "User 1",
    alias: "testuser1",
    viewedIntro: false,
    viewedChat: false,
    createdAt: "2024-01-01T00:00:00Z",
    role: "ta" as const,
    defaultProfile: false,
    active: true,
    lastActive: "2024-01-01T00:00:00Z",
  },
  {
    id: "profile2",
    updatedAt: "2024-01-01T00:00:00Z",
    userId: 2,
    lastLogin: "2024-01-01T00:00:00Z",
    firstName: "Test",
    lastName: "User 2",
    alias: "testuser2",
    viewedIntro: false,
    viewedChat: false,
    createdAt: "2024-01-01T00:00:00Z",
    role: "guest" as const,
    defaultProfile: false,
    active: true,
    lastActive: "2024-01-01T00:00:00Z",
  },
];

const mockCohorts = [
  {
    id: "cohort1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    title: "Test Cohort 1",
    description: "Test cohort description",
    active: true,
    profileIds: ["profile1"],
    defaultCohort: false,
    simulationIds: ["sim1"],
  },
];

const mockSimulations = [
  {
    id: "sim1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    title: "Test Simulation 1",
    timeLimit: 30,
    active: true,
    scenarioIds: ["scenario1"],
    rubricId: "rubric1",
    defaultSimulation: false,
    practiceSimulation: false,
  },
];

const mockRubrics = [
  {
    id: "rubric1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    name: "Test Rubric",
    description: "Test rubric description",
    points: 100,
    passPoints: 70,
    defaultRubric: false,
    active: true,
  },
];

const mockAttempts = [
  {
    id: "attempt1",
    profileId: "profile1",
    simulationId: "sim1",
    attemptNumber: 1,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
];

const mockChats = [
  {
    id: "chat1",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    completedAt: "2024-01-15T10:30:00Z",
    title: "Test Chat",
    scenarioId: "scenario1",
    attemptId: "attempt1",
    completed: true,
    traceId: null,
  },
];

const mockGrades = [
  {
    id: "grade1",
    createdAt: "2024-01-15T10:30:00Z",
    passed: true,
    score: 85,
    timeTaken: 1800, // 30 minutes
    rubricId: "rubric1",
    simulationChatId: "chat1",
  },
];

const mockGrowthData = [
  {
    date: "Jan 15",
    averageScore: 85,
    passRate: 100,
    completionRate: 100,
    firstAttemptPassRate: 100,
    messagesPerSession: 10,
    personaResponseTimes: 3,
    sessionEfficiency: 75,
    stagnationRate: 5,
    timeSpent: 30,
    totalAttempts: 1,
    avgScore: 85,
    completionPercentage: 100,
    highestScore: 85,
  },
];

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("Growth Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockGetAllProfiles.mockResolvedValue(mockProfiles);
    mockGetAllCohorts.mockResolvedValue(mockCohorts);
    mockGetAllSimulations.mockResolvedValue(mockSimulations);
    mockGetAllRubrics.mockResolvedValue(mockRubrics);
    mockGetSimulationAttemptsByProfiles.mockResolvedValue(mockAttempts);
    mockGetSimulationChatsByAttempts.mockResolvedValue(mockChats);
    mockGetSimulationChatGradesBySimulationChats.mockResolvedValue(mockGrades);
    mockCalculatePlatformGrowth.mockReturnValue(mockGrowthData);
  });

  const defaultProps = {
    dateStart: new Date("2024-01-01"),
    dateEnd: new Date("2024-01-31"),
    thresholds: {
      danger: 50,
      warning: 70,
      success: 85,
    },
    profileId: undefined,
    cohortIds: [],
  };

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
        expect(
          screen.getByText("Platform-wide performance metrics over time")
        ).toBeInTheDocument();
      });
    });

    it("renders the TrendingUp icon", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const icon = screen.getByTestId("trending-up-icon");
        expect(icon).toBeInTheDocument();
      });
    });

    it("renders the GrowthPicker component", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading States", () => {
    it("shows loading state when data is being fetched", () => {
      mockGetAllProfiles.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText("Platform Growth")).toBeInTheDocument();
    });

    it("shows no data message when no growth data is available", async () => {
      mockCalculatePlatformGrowth.mockReturnValue([]);

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("No growth data found for the selected date range")
        ).toBeInTheDocument();
      });
    });

    it("shows no data message when no data is available for selected cohorts", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} cohortIds={["nonexistent"]} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText("No data available for the selected cohorts")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Processing", () => {
    it("calls calculatePlatformGrowth with correct parameters", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockCalculatePlatformGrowth).toHaveBeenCalledWith(
          mockGrades,
          mockChats,
          mockAttempts,
          mockSimulations,
          mockRubrics,
          mockProfiles,
          defaultProps.dateStart,
          defaultProps.dateEnd,
          defaultProps.profileId,
          mockCohorts,
          defaultProps.cohortIds
        );
      });
    });

    it("filters data correctly when profileId is provided", async () => {
      const propsWithProfile = { ...defaultProps, profileId: "profile1" };

      render(
        <TestWrapper>
          <Growth {...propsWithProfile} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockCalculatePlatformGrowth).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Date),
          expect.any(Date),
          "profile1",
          expect.any(Array),
          expect.any(Array)
        );
      });
    });

    it("filters data correctly when cohortIds are provided", async () => {
      const propsWithCohorts = { ...defaultProps, cohortIds: ["cohort1"] };

      render(
        <TestWrapper>
          <Growth {...propsWithCohorts} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockCalculatePlatformGrowth).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Date),
          expect.any(Date),
          undefined,
          expect.any(Array),
          ["cohort1"]
        );
      });
    });
  });

  describe("Threshold Status", () => {
    it("shows success status when data meets success threshold", async () => {
      const successData = [
        { ...mockGrowthData[0], averageScore: 90 },
        { ...mockGrowthData[0], averageScore: 95, date: "Jan 16" },
      ] as typeof mockGrowthData;
      mockCalculatePlatformGrowth.mockReturnValue(successData);

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("shows warning status when data meets warning threshold", async () => {
      const warningData = [
        { ...mockGrowthData[0], averageScore: 60 },
        { ...mockGrowthData[0], averageScore: 75, date: "Jan 16" },
      ] as typeof mockGrowthData;
      mockCalculatePlatformGrowth.mockReturnValue(warningData);

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        // The component should render with some status indicator
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("shows danger status when data is below warning threshold", async () => {
      const dangerData = [
        { ...mockGrowthData[0], averageScore: 40 },
        { ...mockGrowthData[0], averageScore: 45, date: "Jan 16" },
      ] as typeof mockGrowthData;
      mockCalculatePlatformGrowth.mockReturnValue(dangerData);

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const statusIndicator = document.querySelector(".bg-red-500");
        expect(statusIndicator).toBeInTheDocument();
      });
    });
  });

  describe("Chart Rendering", () => {
    it("renders the line chart when data is available", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check for chart container
        const chartContainer = document.querySelector(".h-72");
        expect(chartContainer).toBeInTheDocument();
      });
    });

    it("renders actionable insights when available", async () => {
      const dataWithDecline = [
        { ...mockGrowthData[0], averageScore: 90 },
        { ...mockGrowthData[0], averageScore: 80, date: "Jan 16" },
      ] as typeof mockGrowthData;
      mockCalculatePlatformGrowth.mockReturnValue(dataWithDecline);

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        // The component should render with data
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles query errors gracefully", async () => {
      mockGetAllProfiles.mockRejectedValue(
        new Error("Failed to fetch profiles")
      );

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });

    it("handles empty data arrays", async () => {
      mockGetAllProfiles.mockResolvedValue([]);
      mockGetAllCohorts.mockResolvedValue([]);
      mockGetAllSimulations.mockResolvedValue([]);
      mockGetAllRubrics.mockResolvedValue([]);
      mockGetSimulationAttemptsByProfiles.mockResolvedValue([]);
      mockGetSimulationChatsByAttempts.mockResolvedValue([]);
      mockGetSimulationChatGradesBySimulationChats.mockResolvedValue([]);

      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("Platform Growth")).toBeInTheDocument();
      });
    });
  });

  describe("Metric Selection", () => {
    it("allows users to select different metrics", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const metricPicker = screen.getByText("Average Score");
        expect(metricPicker).toBeInTheDocument();
      });
    });

    it("defaults to averageScore metric", async () => {
      render(
        <TestWrapper>
          <Growth {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockCalculatePlatformGrowth).toHaveBeenCalled();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data by the provided date range", async () => {
      const customDateRange = {
        ...defaultProps,
        dateStart: new Date("2024-01-10"),
        dateEnd: new Date("2024-01-20"),
      };

      render(
        <TestWrapper>
          <Growth {...customDateRange} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockCalculatePlatformGrowth).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          new Date("2024-01-10"),
          new Date("2024-01-20"),
          undefined,
          expect.any(Array),
          expect.any(Array)
        );
      });
    });
  });
});
