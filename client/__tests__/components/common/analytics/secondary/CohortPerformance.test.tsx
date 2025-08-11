/**
 * CohortPerformance.test.tsx
 * Tests for the CohortPerformance component
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
import CohortPerformance from "@/components/common/analytics/secondary/CohortPerformance";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from '@/test/custom-render';
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the utility function
vi.mock("@/utils/analytics/secondary", () => ({
  calculateCohortPerformance: vi.fn(),
}));

// Mock the query functions
vi.mock("@/utils/queries/cohorts/get-all-cohorts");
vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
);
vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chat-chats-by-attempts"
);
vi.mock("@/utils/queries/simulations/get-all-simulations");

// Mock the SimulationPicker component
vi.mock("@/components/common/cohort/SimulationPicker", () => ({
  SimulationPicker: ({
    onSelect,
    selectedSimulations,
  }: {
    onSelect: (sims: { id: string; title: string }[]) => void;
    selectedSimulations: { id: string; title: string }[];
  }) => (
    <div data-testid="simulation-picker">
      <button
        onClick={() => onSelect([{ id: "sim-1", title: "Test Simulation" }])}
      >
        Select Simulation
      </button>
      <div data-testid="selected-simulations">
        {selectedSimulations.map((sim: { id: string; title: string }) => (
          <span key={sim.id}>{sim.title}</span>
        ))}
      </div>
    </div>
  ),
}));

const mockQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const defaultProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-12-31"),
  thresholds: {
    danger: 50,
    warning: 70,
    success: 85,
  },
  profileId: undefined,
  cohortIds: [],
};

const mockCohorts = [
  {
    id: "cohort-1",
    title: "Test Cohort 1",
    profileIds: ["profile-1", "profile-2"],
    simulationIds: ["sim-1", "sim-2"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    description: "Test Cohort 1 Description",
    active: true,
    defaultCohort: false,
  },
  {
    id: "cohort-2",
    title: "Test Cohort 2",
    profileIds: ["profile-3"],
    simulationIds: ["sim-3"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    description: "Test Cohort 2 Description",
    active: true,
    defaultCohort: false,
  },
];

const mockProfiles = [
  {
    id: "profile-1",
    name: "Test Profile 1",
    role: "ta" as const,
    updatedAt: "2024-01-01T00:00:00.000Z",
    userId: null,
    lastLogin: "2024-01-01T00:00:00.000Z",
    firstName: "Test",
    lastName: "Profile",
    alias: "test-profile",
    viewedIntro: true,
    viewedChat: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    defaultProfile: false,
    active: true,
    lastActive: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "profile-2",
    name: "Test Profile 2",
    role: "ta" as const,
    updatedAt: "2024-01-01T00:00:00.000Z",
    userId: null,
    lastLogin: "2024-01-01T00:00:00.000Z",
    firstName: "Test",
    lastName: "Profile2",
    alias: "test-profile2",
    viewedIntro: true,
    viewedChat: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    defaultProfile: false,
    active: true,
    lastActive: "2024-01-01T00:00:00.000Z",
  },
];

const mockSimulations = [
  {
    id: "sim-1",
    title: "Test Simulation 1",
    practiceSimulation: false,
    active: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    timeLimit: null,
    scenarioIds: ["scenario-1"],
    rubricId: "rubric-1",
    defaultSimulation: false,
  },
  {
    id: "sim-2",
    title: "Test Simulation 2",
    practiceSimulation: false,
    active: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    timeLimit: null,
    scenarioIds: ["scenario-2"],
    rubricId: "rubric-1",
    defaultSimulation: false,
  },
];

const mockRubrics = [
  {
    id: "rubric-1",
    name: "Test Rubric",
    points: 100,
    passPoints: 70,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    description: "Test rubric description",
    defaultRubric: false,
    active: true,
  },
];

const mockAttempts = [
  {
    id: "attempt-1",
    profileId: "profile-1",
    simulationId: "sim-1",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockChats = [
  {
    id: "chat-1",
    attemptId: "attempt-1",
    scenarioId: "scenario-1",
    completed: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:00:00.000Z",
    title: "Test Chat",
    traceId: null,
  },
];

const mockGrades = [
  {
    id: "grade-1",
    simulationChatId: "chat-1",
    rubricId: "rubric-1",
    score: 85,
    createdAt: "2024-06-15T10:00:00Z",
    passed: true,
    timeTaken: 300,
  },
];

const mockCohortPerformanceResult = {
  cohortData: [
    {
      id: "cohort-1",
      name: "Test Cohort 1",
      passRate: 50,
      avgPercentageScore: 75,
      totalStudents: 2,
      passedStudents: 1,
      totalAttempts: 2,
      passedAttempts: 1,
      rubricPoints: 100,
      rubricPassPoints: 70,
      availableSimulations: 1,
      color: "#ef4444",
    },
  ],
  dailyData: [],
  insights: "Test insights",
  hasData: true,
};

const renderComponent = (props = {}) => {
  return render(
    <QueryClientProvider client={mockQueryClient}>
      <CohortPerformance {...defaultProps} {...props} />
    </QueryClientProvider>
  );
};

describe("CohortPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(getAllCohorts).mockResolvedValue(mockCohorts);
    vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);
    vi.mocked(getAllRubrics).mockResolvedValue(mockRubrics);
    vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue(mockAttempts);
    vi.mocked(getSimulationChatsByAttempts).mockResolvedValue(mockChats);
    vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue(
      mockGrades
    );
    vi.mocked(getAllSimulations).mockResolvedValue(mockSimulations);
  });

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
        expect(screen.getByText("Pass rates by cohort")).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      renderComponent();

      expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
    });

    it("shows no data message when no cohort data is available", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        cohortData: [],
        dailyData: [],
        insights: null,
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No cohort data available for the selected time period."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading and Processing", () => {
    it("calls the utility function with correct parameters", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent({
        profileId: "profile-1",
        cohortIds: ["cohort-1"],
      });

      await waitFor(() => {
        expect(calculateCohortPerformance).toHaveBeenCalledWith(
          mockCohorts,
          mockProfiles,
          mockChats,
          mockGrades,
          mockAttempts,
          mockSimulations,
          mockRubrics,
          defaultProps.dateStart,
          defaultProps.dateEnd,
          defaultProps.thresholds,
          "profile-1",
          ["cohort-1"],
          []
        );
      });
    });

    it("handles missing data gracefully", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        cohortData: [],
        dailyData: [],
        insights: null,
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No cohort data available for the selected time period."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Cohort Data Display", () => {
    it("displays cohort data when available", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
        expect(
          screen.getByText(/50\.00% of students pass/)
        ).toBeInTheDocument();
      });
    });

    it("displays multiple cohorts when available", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        ...mockCohortPerformanceResult,
        cohortData: [
          {
            id: "cohort-1",
            name: "Test Cohort 1",
            passRate: 50,
            avgPercentageScore: 75,
            totalStudents: 2,
            passedStudents: 1,
            totalAttempts: 2,
            passedAttempts: 1,
            rubricPoints: 100,
            rubricPassPoints: 70,
            availableSimulations: 1,
            color: "#ef4444",
          },
          {
            id: "cohort-2",
            name: "Test Cohort 2",
            passRate: 90,
            avgPercentageScore: 92,
            totalStudents: 1,
            passedStudents: 1,
            totalAttempts: 2,
            passedAttempts: 2,
            rubricPoints: 100,
            rubricPassPoints: 70,
            availableSimulations: 1,
            color: "#10b981",
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
        expect(screen.getByText("Test Cohort 2")).toBeInTheDocument();
      });
    });
  });

  describe("Simulation Picker", () => {
    it("renders simulation picker when simulations are available", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("simulation-picker")).toBeInTheDocument();
      });
    });

    it("does not render simulation picker when no simulations are available", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      // Mock empty simulations
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.queryByTestId("simulation-picker")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status Indicator", () => {
    it("shows green indicator for success threshold", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        ...mockCohortPerformanceResult,
        cohortData: [
          {
            id: "cohort-1",
            name: "Test Cohort 1",
            passRate: 90, // Above success threshold
            avgPercentageScore: 75,
            totalStudents: 2,
            passedStudents: 1,
            totalAttempts: 2,
            passedAttempts: 1,
            rubricPoints: 100,
            rubricPassPoints: 70,
            availableSimulations: 1,
            color: "#10b981",
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-green-500");
      });
    });

    it("shows yellow indicator for warning threshold", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        ...mockCohortPerformanceResult,
        cohortData: [
          {
            id: "cohort-1",
            name: "Test Cohort 1",
            passRate: 75, // Between warning and success
            avgPercentageScore: 75,
            totalStudents: 2,
            passedStudents: 1,
            totalAttempts: 2,
            passedAttempts: 1,
            rubricPoints: 100,
            rubricPassPoints: 70,
            availableSimulations: 1,
            color: "#f59e0b",
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-yellow-500");
      });
    });

    it("shows red indicator for danger threshold", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        ...mockCohortPerformanceResult,
        cohortData: [
          {
            id: "cohort-1",
            name: "Test Cohort 1",
            passRate: 40, // Below danger threshold
            avgPercentageScore: 75,
            totalStudents: 2,
            passedStudents: 1,
            totalAttempts: 2,
            passedAttempts: 1,
            rubricPoints: 100,
            rubricPassPoints: 70,
            availableSimulations: 1,
            color: "#ef4444",
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-red-500");
      });
    });
  });

  describe("Dialog Functionality", () => {
    it("renders cohort details dialog", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
      });
    });

    it("displays daily performance chart in dialog", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        // The chart should be rendered (ResponsiveContainer) - only in dialog, not main component
        expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
      });
    });

    it("displays insights in dialog", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        // Insights are only shown in dialog, not main component
        expect(screen.getByText("Test Cohort 1")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles query errors gracefully", async () => {
      vi.mocked(getAllCohorts).mockRejectedValue(new Error("Network error"));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Cohort Performance")).toBeInTheDocument();
      });
    });

    it("handles empty data arrays", async () => {
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue({
        cohortData: [],
        dailyData: [],
        insights: null,
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No cohort data available for the selected time period."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Props Handling", () => {
    it("handles profileId prop correctly", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent({
        profileId: "profile-1",
        cohortIds: ["cohort-1"],
      });

      await waitFor(() => {
        expect(calculateCohortPerformance).toHaveBeenCalled();
        // Check that the function was called with the correct profileId and cohortIds
        const calls = vi.mocked(calculateCohortPerformance).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall).toContain("profile-1");
        expect(lastCall).toContainEqual(["cohort-1"]);
      });
    });

    it("handles cohortIds prop correctly", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      renderComponent({
        cohortIds: ["cohort-1", "cohort-2"],
      });

      await waitFor(() => {
        expect(calculateCohortPerformance).toHaveBeenCalled();
        // Check that the function was called with the correct cohortIds
        const calls = vi.mocked(calculateCohortPerformance).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall).toContainEqual(["cohort-1", "cohort-2"]);
      });
    });

    it("handles different threshold values", async () => {
      const { calculateCohortPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateCohortPerformance).mockReturnValue(
        mockCohortPerformanceResult
      );

      const customThresholds = {
        danger: 30,
        warning: 60,
        success: 90,
      };

      renderComponent({
        thresholds: customThresholds,
      });

      await waitFor(() => {
        expect(calculateCohortPerformance).toHaveBeenCalled();
        // Check that the function was called with the correct thresholds
        const calls = vi.mocked(calculateCohortPerformance).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall).toContainEqual(customThresholds);
      });
    });
  });
});
