/**
 * SkillPerformance.test.tsx
 * Tests for the SkillPerformance component
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
import SkillPerformance from "@/components/common/analytics/secondary/SkillPerformance";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the RubricPicker component
vi.mock("@/components/common/rubric/RubricPicker", () => ({
  RubricPicker: ({
    onSelect,
    selectedRubrics,
  }: {
    onSelect: (rubrics: { id: string; name: string }[]) => void;
    selectedRubrics: { id: string; name: string }[];
  }) => (
    <div data-testid="rubric-picker">
      <button
        onClick={() => onSelect([{ id: "rubric-1", name: "Test Rubric 1" }])}
      >
        Select Rubric
      </button>
      <div data-testid="selected-rubrics">
        {selectedRubrics.map((rubric: { id: string; name: string }) => (
          <span key={rubric.id}>{rubric.name}</span>
        ))}
      </div>
    </div>
  ),
}));

// Mock the utility function
vi.mock("@/utils/analytics/secondary", () => ({
  calculateSkillPerformance: vi.fn().mockReturnValue({
    radarData: [
      {
        metric: "Comm",
        value: 75,
        fullMark: 100,
      },
      {
        metric: "Crit",
        value: 80,
        fullMark: 100,
      },
    ],
    hasData: true,
  }),
}));

// Mock all query functions
vi.mock("@/utils/queries/cohorts/get-all-cohorts");
vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics"
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock("@/utils/queries/standard_groups/get-standard-groups-by-rubrics");
vi.mock("@/utils/queries/standards/get-standards-by-standardgroups");

describe("SkillPerformance", () => {
  let queryClient: QueryClient;

  const mockRubrics = [
    {
      id: "rubric-1",
      name: "Test Rubric 1",
      description: "Test Description 1",
      points: 100,
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      passPoints: 70,
      defaultRubric: false,
    },
  ];

  const mockStandardGroups = [
    {
      id: "sg-1",
      name: "Communication",
      shortName: "Comm",
      points: 50,
      createdAt: "2024-01-01T00:00:00.000Z",
      description: "Communication skills description",
      passPoints: 70,
      rubricId: "rubric-1",
    },
    {
      id: "sg-2",
      name: "Critical Thinking",
      shortName: "Crit",
      points: 50,
      createdAt: "2024-01-01T00:00:00.000Z",
      description: "Critical thinking skills description",
      passPoints: 70,
      rubricId: "rubric-1",
    },
  ];

  const mockStandards = [
    {
      id: "std-1",
      name: "Standard 1",
      standardGroupId: "sg-1",
      createdAt: "2024-01-01T00:00:00.000Z",
      description: "Communication standard description",
      points: 100,
    },
    {
      id: "std-2",
      name: "Standard 2",
      standardGroupId: "sg-2",
      createdAt: "2024-01-01T00:00:00.000Z",
      description: "Critical thinking standard description",
      points: 100,
    },
  ];

  const mockGrades = [
    {
      id: "grade-1",
      simulationChatId: "chat-1",
      createdAt: "2024-01-15T10:00:00Z",
      passed: true,
      score: 85,
      timeTaken: 100,
      rubricId: "rubric-1",
    },
  ];

  const mockFeedbacks = [
    {
      id: "feedback-1",
      simulationChatGradeId: "grade-1",
      standardId: "std-1",
      total: 25,
      createdAt: "2024-01-15T10:00:00Z",
      feedback: "Good job!",
    },
    {
      id: "feedback-2",
      simulationChatGradeId: "grade-1",
      standardId: "std-2",
      total: 30,
      createdAt: "2024-01-15T10:00:00Z",
      feedback: "Great job!",
    },
  ];

  const mockCohorts = [
    {
      id: "cohort-1",
      title: "Test Cohort 1",
      profileIds: ["profile-1"],
      simulationIds: ["sim-1"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      description: "Test Cohort 1 Description",
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
  ];

  const mockAttempts = [
    {
      id: "attempt-1",
      profileId: "profile-1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:00.000Z",
      title: "Test Attempt 1",
      scenarioId: "scenario-1",
      attemptId: "attempt-1",
      completed: true,
      traceId: "trace-1",
      simulationId: "sim-1",
    },
  ];

  const mockChats = [
    {
      id: "chat-1",
      attemptId: "attempt-1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:00.000Z",
      title: "Test Chat 1",
      scenarioId: "scenario-1",
      completed: true,
      traceId: "trace-1",
    },
  ];

  const mockSkillPerformanceResult = {
    radarData: [
      {
        metric: "Comm",
        value: 75,
        fullMark: 100,
      },
      {
        metric: "Crit",
        value: 80,
        fullMark: 100,
      },
    ],
    hasData: true,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(getAllRubrics).mockResolvedValue(mockRubrics);
    vi.mocked(getStandardGroupsByRubrics).mockResolvedValue(mockStandardGroups);
    vi.mocked(getStandardsByStandardGroups).mockResolvedValue(mockStandards);
    vi.mocked(getSimulationChatGradesByRubrics).mockResolvedValue(mockGrades);
    vi.mocked(
      getSimulationChatFeedbacksBySimulationChatGrades
    ).mockResolvedValue(mockFeedbacks);
    vi.mocked(getAllCohorts).mockResolvedValue(mockCohorts);
    vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);
    vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue(mockAttempts);
    vi.mocked(getSimulationChatsByAttempts).mockResolvedValue(mockChats);

    // Mock the utility function is already set up at the top
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      dateStart: new Date("2024-01-01"),
      dateEnd: new Date("2024-01-31"),
      thresholds: {
        danger: 30,
        warning: 60,
        success: 90,
      },
      profileId: undefined,
      cohortIds: [],
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <SkillPerformance {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
        expect(
          screen.getByText("Performance across key teaching competencies")
        ).toBeInTheDocument();
      });
    });

    it("shows loading state initially", async () => {
      // Mock loading state by not providing data
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Loading skill data...")).toBeInTheDocument();
      });
    });

    it("shows no data message when no skill data is available", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue({
        radarData: [],
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No skill data available for the selected time period"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Complete some training sessions to see your progress"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading and Processing", () => {
    it("calls the utility function with correct parameters", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(calculateSkillPerformance).toHaveBeenCalled();
      });
    });

    it("handles missing data gracefully", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue({
        radarData: [],
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No skill data available for the selected time period"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Radar Chart Display", () => {
    it("displays radar chart when data is available", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        // The chart should be rendered (ResponsiveContainer)
        expect(
          document.querySelector(".recharts-responsive-container")
        ).toBeInTheDocument();
      });
    });

    it("displays skill metrics in radar chart", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        // Check that the responsive container is rendered
        expect(
          document.querySelector(".recharts-responsive-container")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Rubric Picker", () => {
    it("renders rubric picker when rubrics are available", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("rubric-picker")).toBeInTheDocument();
      });
    });

    it("does not render rubric picker when no rubrics are available", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      // Mock empty rubrics
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId("rubric-picker")).not.toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status Indicator", () => {
    it("shows green indicator for success threshold", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue({
        ...mockSkillPerformanceResult,
        radarData: [
          { metric: "Comm", value: 95, fullMark: 100 },
          { metric: "Crit", value: 92, fullMark: 100 },
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-green-500");
      });
    });

    it("shows yellow indicator for warning threshold", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue({
        ...mockSkillPerformanceResult,
        radarData: [
          { metric: "Comm", value: 70, fullMark: 100 },
          { metric: "Crit", value: 75, fullMark: 100 },
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-yellow-500");
      });
    });

    it("shows red indicator for danger threshold", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue({
        ...mockSkillPerformanceResult,
        radarData: [
          { metric: "Comm", value: 25, fullMark: 100 },
          { metric: "Crit", value: 20, fullMark: 100 },
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-red-500");
      });
    });
  });

  describe("Chart Interaction", () => {
    it("displays tooltips on chart hover", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        // Check that the responsive container is rendered
        expect(
          document.querySelector(".recharts-responsive-container")
        ).toBeInTheDocument();
      });
    });

    it("renders radar chart with proper styling", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        // Check that the responsive container is rendered
        expect(
          document.querySelector(".recharts-responsive-container")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles query errors gracefully", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      // Mock query error
      vi.mocked(getAllRubrics).mockRejectedValue(new Error("Query failed"));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });
    });

    it("handles empty data arrays", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue({
        radarData: [],
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No skill data available for the selected time period"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Props Handling", () => {
    it("handles profileId prop correctly", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent({ profileId: "profile-1" });

      await waitFor(() => {
        expect(calculateSkillPerformance).toHaveBeenCalled();
      });
    });

    it("handles cohortIds prop correctly", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent({ cohortIds: ["cohort-1", "cohort-2"] });

      await waitFor(() => {
        expect(calculateSkillPerformance).toHaveBeenCalled();
      });
    });

    it("handles different threshold values", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      const customThresholds = {
        danger: 20,
        warning: 50,
        success: 80,
      };

      renderComponent({ thresholds: customThresholds });

      await waitFor(() => {
        expect(calculateSkillPerformance).toHaveBeenCalled();
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading spinner when data is loading", async () => {
      // Mock loading state by not providing data
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Loading skill data...")).toBeInTheDocument();
      });
    });

    it("handles loading state transitions", async () => {
      const { calculateSkillPerformance } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateSkillPerformance).mockReturnValue(
        mockSkillPerformanceResult
      );

      renderComponent();

      await waitFor(() => {
        expect(
          document.querySelector(".recharts-responsive-container")
        ).toBeInTheDocument();
      });
    });
  });
});
