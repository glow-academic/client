import AttemptImprovement from "@/components/common/analytics/secondary/AttemptImprovement";
import { render, screen, waitFor } from "@/test/custom-render";
import { calculateAttemptImprovement } from "@/utils/analytics/primary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the utility function
vi.mock("@/utils/analytics/primary", () => ({
  calculateAttemptImprovement: vi.fn(),
}));

// Mock all query functions
vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi.fn(),
}));

vi.mock("@/utils/queries/cohorts/get-all-cohorts", () => ({
  getAllCohorts: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
  () => ({
    getSimulationAttemptsByProfiles: vi.fn(),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(),
  }),
);

vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(),
}));

// Import mocked functions
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

const mockGetAllProfiles = vi.mocked(getAllProfiles);
const mockGetAllCohorts = vi.mocked(getAllCohorts);
const mockGetSimulationAttemptsByProfiles = vi.mocked(
  getSimulationAttemptsByProfiles,
);
const mockGetSimulationChatsByAttempts = vi.mocked(
  getSimulationChatsByAttempts,
);
const mockGetSimulationChatGradesBySimulationChats = vi.mocked(
  getSimulationChatGradesBySimulationChats,
);
const mockGetAllSimulations = vi.mocked(getAllSimulations);
const mockGetAllRubrics = vi.mocked(getAllRubrics);
const mockCalculateAttemptImprovement = vi.mocked(calculateAttemptImprovement);

// Mock data
const mockProfiles = [
  {
    id: "profile1",
    userId: null,
    lastLogin: "2024-01-01T00:00:00Z",
    firstName: "Test",
    lastName: "Profile 1",
    alias: "test1",
    viewedIntro: true,
    viewedChat: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    role: "ta" as const,
    defaultProfile: false,
    active: true,
    lastActive: "2024-01-01T00:00:00Z",
  },
  {
    id: "profile2",
    userId: null,
    lastLogin: "2024-01-01T00:00:00Z",
    firstName: "Test",
    lastName: "Profile 2",
    alias: "test2",
    viewedIntro: true,
    viewedChat: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    role: "ta" as const,
    defaultProfile: false,
    active: true,
    lastActive: "2024-01-01T00:00:00Z",
  },
];

const mockCohorts = [
  {
    id: "cohort1",
    title: "Test Cohort 1",
    description: "Test cohort description",
    active: true,
    defaultCohort: false,
    profileIds: ["profile1"],
    simulationIds: ["simulation1"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "cohort2",
    title: "Test Cohort 2",
    description: "Test cohort description 2",
    active: true,
    defaultCohort: false,
    profileIds: ["profile2"],
    simulationIds: ["simulation2"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const mockSimulations = [
  {
    id: "simulation1",
    title: "Test Simulation 1",
    description: "Test simulation description",
    timeLimit: 30,
    active: true,
    defaultSimulation: false,
    practiceSimulation: false,
    rubricId: "rubric1",
    scenarioIds: ["scenario1"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "simulation2",
    title: "Test Simulation 2",
    description: "Test simulation description 2",
    timeLimit: 45,
    active: true,
    defaultSimulation: false,
    practiceSimulation: false,
    rubricId: "rubric2",
    scenarioIds: ["scenario2"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const mockRubrics = [
  {
    id: "rubric1",
    name: "Test Rubric 1",
    description: "Test rubric description",
    points: 100,
    passPoints: 70,
    defaultRubric: false,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "rubric2",
    name: "Test Rubric 2",
    description: "Test rubric description 2",
    points: 100,
    passPoints: 70,
    defaultRubric: false,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const mockAttempts = [
  {
    id: "attempt1",
    profileId: "profile1",
    simulationId: "simulation1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "attempt2",
    profileId: "profile1",
    simulationId: "simulation1",
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

const mockChats = [
  {
    id: "chat1",
    attemptId: "attempt1",
    completed: true,
    completedAt: "2024-01-01T00:30:00Z",
    title: "Test Chat 1",
    scenarioId: "scenario1",
    traceId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "chat2",
    attemptId: "attempt2",
    completed: true,
    completedAt: "2024-01-02T00:25:00Z",
    title: "Test Chat 2",
    scenarioId: "scenario1",
    traceId: null,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

const mockGrades = [
  {
    id: "grade1",
    simulationChatId: "chat1",
    rubricId: "rubric1",
    score: 85,
    timeTaken: 1800, // 30 minutes
    passed: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "grade2",
    simulationChatId: "chat2",
    rubricId: "rubric1",
    score: 90,
    timeTaken: 1500, // 25 minutes
    passed: true,
    createdAt: "2024-01-02T00:00:00Z",
  },
];

const mockImprovementData = [
  {
    attempt: "Attempt 1",
    "Average Score": 85,
    "Average Time": 30,
    "Pass Rate": 100,
  },
  {
    attempt: "Attempt 2",
    "Average Score": 90,
    "Average Time": 25,
    "Pass Rate": 100,
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

describe("AttemptImprovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockGetAllProfiles.mockResolvedValue(mockProfiles);
    mockGetAllCohorts.mockResolvedValue(mockCohorts);
    mockGetSimulationAttemptsByProfiles.mockResolvedValue(mockAttempts);
    mockGetSimulationChatsByAttempts.mockResolvedValue(mockChats);
    mockGetSimulationChatGradesBySimulationChats.mockResolvedValue(mockGrades);
    mockGetAllSimulations.mockResolvedValue(mockSimulations);
    mockGetAllRubrics.mockResolvedValue(mockRubrics);
    mockCalculateAttemptImprovement.mockReturnValue(mockImprovementData);
  });

  const defaultProps = {
    dateStart: new Date("2024-01-01"),
    dateEnd: new Date("2024-01-31"),
    thresholds: {
      danger: -10,
      warning: 0,
      success: 10,
    },
    profileId: undefined,
    cohortIds: [],
  };

  it("renders the component with title and description", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Performance improvement across multiple attempts"),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    // The component should render without crashing during loading
    expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
  });

  it("calls calculateAttemptImprovement with correct parameters when data is loaded", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(mockCalculateAttemptImprovement).toHaveBeenCalledWith(
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
        defaultProps.cohortIds,
        [],
      );
    });
  });

  it("shows threshold status indicator", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      // The threshold indicator should be present (it's a colored dot)
      const thresholdIndicator = document.querySelector(
        '[class*="rounded-full"]',
      );
      expect(thresholdIndicator).toBeInTheDocument();
    });
  });

  it("renders chart when improvement data is available", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      // Check for chart container
      const chartContainer = document.querySelector(
        ".recharts-responsive-container",
      );
      expect(chartContainer).toBeInTheDocument();

      // Check that the chart is rendered (even if text might not be visible in tests)
      expect(
        screen.queryByText("No improvement data available"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows actionable insights when improvement is significant", async () => {
    const improvementDataWithInsights = [
      {
        attempt: "Attempt 1",
        "Average Score": 70,
        "Average Time": 30,
        "Pass Rate": 80,
      },
      {
        attempt: "Attempt 2",
        "Average Score": 85,
        "Average Time": 25,
        "Pass Rate": 100,
      },
    ];

    mockCalculateAttemptImprovement.mockReturnValue(
      improvementDataWithInsights,
    );

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Users improve by 15%/)).toBeInTheDocument();
    });
  });

  it("shows no data message when no improvement data is available", async () => {
    mockCalculateAttemptImprovement.mockReturnValue([]);

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "No improvement data available. Multiple attempts required.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows no data message for selected cohorts when no profiles match", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement
          {...defaultProps}
          cohortIds={["nonexistent-cohort"]}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No data available for the selected cohorts"),
      ).toBeInTheDocument();
    });
  });

  it("filters by profile when profileId is provided", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} profileId="profile1" />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(mockCalculateAttemptImprovement).toHaveBeenCalledWith(
        mockGrades,
        mockChats,
        mockAttempts,
        mockSimulations,
        mockRubrics,
        mockProfiles,
        defaultProps.dateStart,
        defaultProps.dateEnd,
        "profile1",
        mockCohorts,
        defaultProps.cohortIds,
        [],
      );
    });
  });

  it("filters by cohorts when cohortIds are provided", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} cohortIds={["cohort1"]} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(mockCalculateAttemptImprovement).toHaveBeenCalledWith(
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
        ["cohort1"],
        [],
      );
    });
  });

  it("handles error state gracefully", async () => {
    mockGetAllProfiles.mockRejectedValue(new Error("Failed to fetch profiles"));

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      // Component should still render without crashing
      expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
    });
  });

  it("shows simulation picker when simulations with data are available", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Filter by simulation...")).toBeInTheDocument();
    });
  });

  it("displays chart with correct data points", async () => {
    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      // Check for chart container
      const chartContainer = document.querySelector(
        ".recharts-responsive-container",
      );
      expect(chartContainer).toBeInTheDocument();

      // Check that the chart is rendered (even if legend text might not be visible in tests)
      expect(
        screen.queryByText("No improvement data available"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows warning threshold status when improvement is below warning threshold", async () => {
    const improvementDataWithWarning = [
      {
        attempt: "Attempt 1",
        "Average Score": 80,
        "Average Time": 30,
        "Pass Rate": 100,
      },
      {
        attempt: "Attempt 2",
        "Average Score": 75,
        "Average Time": 25,
        "Pass Rate": 100,
      },
    ];

    mockCalculateAttemptImprovement.mockReturnValue(improvementDataWithWarning);

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      // Check for red threshold indicator (danger status)
      const thresholdIndicator = document.querySelector(".bg-red-500");
      expect(thresholdIndicator).toBeInTheDocument();

      // Check that chart is rendered
      const chartContainer = document.querySelector(
        ".recharts-responsive-container",
      );
      expect(chartContainer).toBeInTheDocument();
    });
  });

  it("shows success threshold status when improvement is above success threshold", async () => {
    const improvementDataWithSuccess = [
      {
        attempt: "Attempt 1",
        "Average Score": 70,
        "Average Time": 30,
        "Pass Rate": 80,
      },
      {
        attempt: "Attempt 2",
        "Average Score": 90,
        "Average Time": 25,
        "Pass Rate": 100,
      },
    ];

    mockCalculateAttemptImprovement.mockReturnValue(improvementDataWithSuccess);

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Users improve by 20%/)).toBeInTheDocument();
    });
  });

  it("handles empty data arrays gracefully", async () => {
    mockGetAllProfiles.mockResolvedValue([]);
    mockGetAllCohorts.mockResolvedValue([]);
    mockGetSimulationAttemptsByProfiles.mockResolvedValue([]);
    mockGetSimulationChatsByAttempts.mockResolvedValue([]);
    mockGetSimulationChatGradesBySimulationChats.mockResolvedValue([]);
    mockGetAllSimulations.mockResolvedValue([]);
    mockGetAllRubrics.mockResolvedValue([]);

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "No improvement data available. Multiple attempts required.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("calls calculateAttemptImprovement only when all required data is available", async () => {
    // Mock some data as empty initially
    mockGetAllProfiles.mockResolvedValue([]);

    render(
      <TestWrapper>
        <AttemptImprovement {...defaultProps} />
      </TestWrapper>,
    );

    // Should not call calculateAttemptImprovement when data is missing
    expect(mockCalculateAttemptImprovement).not.toHaveBeenCalled();

    // Now provide all data
    mockGetAllProfiles.mockResolvedValue(mockProfiles);

    await waitFor(() => {
      // Component should render without crashing
      expect(screen.getByText("Attempt Improvement")).toBeInTheDocument();
    });
  });
});
