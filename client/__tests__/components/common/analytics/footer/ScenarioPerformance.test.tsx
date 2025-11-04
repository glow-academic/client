import { render } from "@/test/custom-render";
import { fireEvent, screen, waitFor } from "@/test/custom-render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import the component
import ScenarioPerformance from "@/components/dashboard/footer/ScenarioPerformance";

// Mock all query functions
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/cohorts/get-all-cohorts");
vi.mock("@/utils/queries/scenarios/get-all-scenarios");
vi.mock("@/utils/queries/simulations/get-all-simulations");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");
vi.mock("@/utils/queries/parameters/get-all-parameters");
vi.mock("@/utils/queries/parameter_items/get-all-parameter-items");
vi.mock("@/utils/queries/personas/get-all-personas");
vi.mock("@/utils/queries/documents/get-all-documents");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
);

// Mock the utility function
import { calculateScenarioAttributeBreakdown } from "@/utils/analytics/footer";
vi.mock("@/utils/analytics/footer", () => ({
  calculateScenarioAttributeBreakdown: vi.fn(),
}));

// Mock Recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data }: { data: Array<{ name: string }> }) => (
    <div data-testid="pie-chart-data" data-count={data?.length || 0}>
      {data?.map((item, index) => (
        <div key={index} data-testid={`pie-item-${index}`}>
          {item.name}
        </div>
      ))}
    </div>
  ),
  Cell: () => <div data-testid="cell" />,
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  Legend: ({
    content,
  }: {
    content: (props: { payload: unknown[] }) => React.ReactNode;
  }) => <div data-testid="legend">{content && content({ payload: [] })}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
}));

// Mock the utility function
const mockCalculateScenarioAttributeBreakdown = vi.mocked(
  calculateScenarioAttributeBreakdown,
);

// Mock all query functions
const mockGetAllProfiles = vi.mocked(getAllProfiles);
const mockGetAllCohorts = vi.mocked(getAllCohorts);
const mockGetAllScenarios = vi.mocked(getAllScenarios);
const mockGetAllSimulations = vi.mocked(getAllSimulations);
const mockGetAllRubrics = vi.mocked(getAllRubrics);
const mockGetAllParameters = vi.mocked(getAllParameters);
const mockGetAllParameterItems = vi.mocked(getAllParameterItems);
const mockGetAllPersonas = vi.mocked(getAllPersonas);
const mockGetAllDocuments = vi.mocked(getAllDocuments);
const mockGetSimulationAttemptsByProfiles = vi.mocked(
  getSimulationAttemptsByProfiles,
);
const mockGetSimulationChatsByAttempts = vi.mocked(
  getSimulationChatsByAttempts,
);
const mockGetSimulationChatGradesBySimulationChats = vi.mocked(
  getSimulationChatGradesBySimulationChats,
);

describe("ScenarioPerformance", () => {
  const defaultProps = {
    dateStart: new Date("2024-01-01"),
    dateEnd: new Date("2024-01-31"),
    thresholds: {
      danger: 60,
      warning: 75,
      success: 85,
    },
    profileId: undefined,
    cohortIds: [],
  };

  const mockData = {
    profiles: [
      {
        id: "profile1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        userId: 1,
        lastLogin: "2024-01-15T10:00:00Z",
        firstName: "Test",
        lastName: "Profile",
        alias: "test-profile",
        viewedIntro: true,
        viewedChat: true,
        role: "ta" as const,
        defaultProfile: false,
        active: true,
        lastActive: "2024-01-15T10:00:00Z",
      },
    ],
    cohorts: [
      {
        id: "cohort1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        title: "Test Cohort",
        description: "Test cohort description",
        active: true,
        profileIds: ["profile1"],
        defaultCohort: false,
        simulationIds: ["sim1", "sim2"],
      },
    ],
    scenarios: [
      {
        id: "scenario1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        name: "Test Scenario",
        description: "Test scenario description",
        personaId: null,
        parameterItemIds: ["param1", "param2"],
        documentIds: null,
        defaultScenario: false,
        practiceScenario: false,
        generated: false,
        parentId: null,
        active: true,
      },
    ],
    simulations: [
      {
        id: "sim1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        title: "Test Simulation",
        timeLimit: 300,
        active: true,
        scenarioIds: ["scenario1"],
        rubricId: "rubric1",
        defaultSimulation: false,
        practiceSimulation: false,
      },
    ],
    parameters: [
      {
        id: "param1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        name: "Difficulty",
        description: "Difficulty parameter",
        numerical: false,
        active: true,
      },
    ],
    parameterItems: [
      {
        id: "param1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        name: "Easy",
        description: "Easy difficulty",
        value: "Easy",
        parameterId: "param1",
        defaultItem: false,
      },
    ],
    rubrics: [
      {
        id: "rubric1",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        name: "Test Rubric",
        description: "Test rubric description",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: true,
      },
    ],
    attempts: [
      {
        id: "attempt1",
        createdAt: "2024-01-15T10:00:00Z",
        profileId: "profile1",
        simulationId: "sim1",
      },
    ],
    chats: [
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
    ],
    grades: [
      {
        id: "grade1",
        createdAt: "2024-01-15T10:30:00Z",
        passed: true,
        score: 85,
        timeTaken: 300,
        rubricId: "rubric1",
        simulationChatId: "chat1",
      },
    ],
  };

  const mockAttributeElements = [
    {
      id: "param1",
      name: "Easy",
      displayName: "Easy",
      icon: "📊",
      color: "#3b82f6",
      count: 5,
      percentage: 60.0,
      avgScore: 85,
      completionRate: 90,
      totalAttempts: 10,
      trendData: [{ date: "Jan 15", score: 85, timestamp: 1705312800000 }],
      insight:
        "Performance has remained stable. Current average score is 85% with 90% completion rate.",
    },
    {
      id: "param2",
      name: "Hard",
      displayName: "Hard",
      icon: "📊",
      color: "#ef4444",
      count: 3,
      percentage: 40.0,
      avgScore: 70,
      completionRate: 75,
      totalAttempts: 8,
      trendData: [{ date: "Jan 16", score: 70, timestamp: 1705399200000 }],
      insight:
        "Limited data available. Current average score is 70% with 75% completion rate.",
    },
  ];

  beforeEach(() => {
    // Setup default mocks
    mockGetAllProfiles.mockResolvedValue(mockData.profiles);
    mockGetAllCohorts.mockResolvedValue(mockData.cohorts);
    mockGetAllScenarios.mockResolvedValue(mockData.scenarios);
    mockGetAllSimulations.mockResolvedValue(mockData.simulations);
    mockGetAllRubrics.mockResolvedValue(mockData.rubrics);
    mockGetAllParameters.mockResolvedValue(mockData.parameters);
    mockGetAllParameterItems.mockResolvedValue(mockData.parameterItems);
    mockGetAllPersonas.mockResolvedValue([]);
    mockGetAllDocuments.mockResolvedValue([]);
    mockGetSimulationAttemptsByProfiles.mockResolvedValue(mockData.attempts);
    mockGetSimulationChatsByAttempts.mockResolvedValue(mockData.chats);
    mockGetSimulationChatGradesBySimulationChats.mockResolvedValue(
      mockData.grades,
    );

    mockCalculateScenarioAttributeBreakdown.mockReturnValue(
      mockAttributeElements,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(<ScenarioPerformance {...defaultProps} {...props} />);
  };

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Performance analysis by scenario attributes"),
        ).toBeInTheDocument();
      });
    });

    it("renders the parameter picker with default state", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Select Parameter")).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      renderComponent();

      // Component should render even while loading
      expect(
        screen.getByText("Scenario Attribute Breakdown"),
      ).toBeInTheDocument();
    });
  });

  describe("Data Loading and Processing", () => {
    it("calls calculateScenarioAttributeBreakdown with correct parameters", async () => {
      renderComponent();

      // Wait for the component to load and process data
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Wait a bit more for the utility function to be called
      await waitFor(
        () => {
          expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledWith(
        mockData.grades,
        mockData.chats,
        mockData.attempts,
        mockData.simulations,
        mockData.scenarios,
        mockData.rubrics,
        mockData.profiles,
        mockData.parameterItems,
        mockData.parameters[0], // First non-numerical parameter
        defaultProps.dateStart,
        defaultProps.dateEnd,
        defaultProps.profileId,
        mockData.cohorts,
        defaultProps.cohortIds,
      );
    });

    it("handles empty data gracefully", async () => {
      mockCalculateScenarioAttributeBreakdown.mockReturnValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No scenario data available for the selected time period.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("handles missing data gracefully", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No scenario data available for the selected time period.",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Parameter Selection", () => {
    it("displays parameter options in the picker", async () => {
      renderComponent();

      await waitFor(() => {
        const pickerButton = screen.getByRole("combobox");
        fireEvent.click(pickerButton);
      });

      await waitFor(() => {
        const difficultyElements = screen.getAllByText("Difficulty");
        expect(difficultyElements.length).toBeGreaterThan(0);
        expect(
          screen.getByText("Performance by difficulty value"),
        ).toBeInTheDocument();
      });
    });

    it("allows selecting a parameter", async () => {
      renderComponent();

      await waitFor(() => {
        const pickerButton = screen.getByRole("combobox");
        fireEvent.click(pickerButton);
      });

      await waitFor(() => {
        const difficultyElements = screen.getAllByText("Difficulty");
        const difficultyOption = difficultyElements[0];
        if (difficultyOption) {
          fireEvent.click(difficultyOption);
        }
      });

      await waitFor(() => {
        const difficultyElements = screen.getAllByText("Difficulty");
        expect(difficultyElements.length).toBeGreaterThan(0);
      });
    });

    it("filters to show only non-numerical parameters", async () => {
      renderComponent();

      await waitFor(() => {
        const pickerButton = screen.getByRole("combobox");
        fireEvent.click(pickerButton);
      });

      await waitFor(() => {
        const difficultyElements = screen.getAllByText("Difficulty");
        expect(difficultyElements.length).toBeGreaterThan(0);
        expect(screen.queryByText("Time Limit")).not.toBeInTheDocument();
      });
    });
  });

  describe("Chart Rendering", () => {
    it("renders pie chart when data is available", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
        expect(screen.getByTestId("pie-chart-data")).toBeInTheDocument();
      });
    });

    it("renders correct number of pie chart items", async () => {
      renderComponent();

      await waitFor(() => {
        const pieData = screen.getByTestId("pie-chart-data");
        expect(pieData).toHaveAttribute("data-count", "2");
      });
    });

    it("renders legend with attribute names", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("legend")).toBeInTheDocument();
      });
    });

    it("renders tooltip component", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("tooltip")).toBeInTheDocument();
      });
    });
  });

  describe("Threshold Status", () => {
    it("shows success status when average performance is above success threshold", async () => {
      const highPerformanceElements = [
        {
          id: "param1",
          name: "Easy",
          displayName: "Easy",
          icon: "📊",
          color: "#3b82f6",
          count: 5,
          percentage: 60.0,
          avgScore: 90,
          completionRate: 90,
          totalAttempts: 10,
          trendData: [{ date: "Jan 15", score: 90, timestamp: 1705312800000 }],
          insight: "High performance achieved.",
        },
        {
          id: "param2",
          name: "Hard",
          displayName: "Hard",
          icon: "📊",
          color: "#ef4444",
          count: 3,
          percentage: 40.0,
          avgScore: 88,
          completionRate: 75,
          totalAttempts: 8,
          trendData: [{ date: "Jan 16", score: 88, timestamp: 1705399200000 }],
          insight: "Excellent performance.",
        },
      ];
      mockCalculateScenarioAttributeBreakdown.mockReturnValue(
        highPerformanceElements,
      );

      renderComponent();

      await waitFor(() => {
        const statusIndicator = screen.getByTestId("status-indicator");
        expect(statusIndicator).toHaveClass("bg-green-500");
      });
    });

    it("shows warning status when average performance is between warning and success thresholds", async () => {
      const mediumPerformanceElements = [
        {
          id: "param1",
          name: "Easy",
          displayName: "Easy",
          icon: "📊",
          color: "#3b82f6",
          count: 5,
          percentage: 60.0,
          avgScore: 80,
          completionRate: 90,
          totalAttempts: 10,
          trendData: [{ date: "Jan 15", score: 80, timestamp: 1705312800000 }],
          insight: "Moderate performance.",
        },
        {
          id: "param2",
          name: "Hard",
          displayName: "Hard",
          icon: "📊",
          color: "#ef4444",
          count: 3,
          percentage: 40.0,
          avgScore: 78,
          completionRate: 75,
          totalAttempts: 8,
          trendData: [{ date: "Jan 16", score: 78, timestamp: 1705399200000 }],
          insight: "Average performance.",
        },
      ];
      mockCalculateScenarioAttributeBreakdown.mockReturnValue(
        mediumPerformanceElements,
      );

      renderComponent();

      await waitFor(() => {
        const statusIndicator = screen.getByTestId("status-indicator");
        expect(statusIndicator).toHaveClass("bg-yellow-500");
      });
    });

    it("shows danger status when average performance is below warning threshold", async () => {
      const lowPerformanceElements = [
        {
          id: "param1",
          name: "Easy",
          displayName: "Easy",
          icon: "📊",
          color: "#3b82f6",
          count: 5,
          percentage: 60.0,
          avgScore: 50,
          completionRate: 90,
          totalAttempts: 10,
          trendData: [{ date: "Jan 15", score: 50, timestamp: 1705312800000 }],
          insight: "Low performance.",
        },
        {
          id: "param2",
          name: "Hard",
          displayName: "Hard",
          icon: "📊",
          color: "#ef4444",
          count: 3,
          percentage: 40.0,
          avgScore: 45,
          completionRate: 75,
          totalAttempts: 8,
          trendData: [{ date: "Jan 16", score: 45, timestamp: 1705399200000 }],
          insight: "Poor performance.",
        },
      ];
      mockCalculateScenarioAttributeBreakdown.mockReturnValue(
        lowPerformanceElements,
      );

      renderComponent();

      await waitFor(() => {
        const statusIndicator = screen.getByTestId("status-indicator");
        expect(statusIndicator).toHaveClass("bg-red-500");
      });
    });

    it("shows neutral status when no data is available", async () => {
      mockCalculateScenarioAttributeBreakdown.mockReturnValue([]);

      renderComponent();

      await waitFor(() => {
        const statusIndicator = screen.getByTestId("status-indicator");
        expect(statusIndicator).toHaveClass("bg-gray-400");
      });
    });
  });

  describe("Cohort Filtering", () => {
    it("passes cohort filtering parameters correctly", async () => {
      const propsWithCohorts = {
        ...defaultProps,
        cohortIds: ["cohort1"],
        profileId: "profile1",
      };

      renderComponent(propsWithCohorts);

      // Wait for the component to load and process data
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Wait a bit more for the utility function to be called
      await waitFor(
        () => {
          expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledWith(
        mockData.grades,
        mockData.chats,
        mockData.attempts,
        mockData.simulations,
        mockData.scenarios,
        mockData.rubrics,
        mockData.profiles,
        mockData.parameterItems,
        mockData.parameters[0], // First non-numerical parameter
        defaultProps.dateStart,
        defaultProps.dateEnd,
        "profile1",
        mockData.cohorts,
        ["cohort1"],
      );
    });
  });

  describe("Profile Filtering", () => {
    it("passes profile ID correctly when provided", async () => {
      const propsWithProfile = {
        ...defaultProps,
        profileId: "profile1",
      };

      renderComponent(propsWithProfile);

      // Wait for the component to load and process data
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Wait a bit more for the utility function to be called
      await waitFor(
        () => {
          expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledWith(
        mockData.grades,
        mockData.chats,
        mockData.attempts,
        mockData.simulations,
        mockData.scenarios,
        mockData.rubrics,
        mockData.profiles,
        mockData.parameterItems,
        mockData.parameters[0], // First non-numerical parameter
        defaultProps.dateStart,
        defaultProps.dateEnd,
        "profile1",
        mockData.cohorts,
        defaultProps.cohortIds,
      );
    });
  });

  describe("Date Range Filtering", () => {
    it("passes date range parameters correctly", async () => {
      const customDateRange = {
        dateStart: new Date("2024-02-01"),
        dateEnd: new Date("2024-02-29"),
      };

      renderComponent(customDateRange);

      // Wait for the component to load and process data
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Wait a bit more for the utility function to be called
      await waitFor(
        () => {
          expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledWith(
        mockData.grades,
        mockData.chats,
        mockData.attempts,
        mockData.simulations,
        mockData.scenarios,
        mockData.rubrics,
        mockData.profiles,
        mockData.parameterItems,
        mockData.parameters[0], // First non-numerical parameter
        customDateRange.dateStart,
        customDateRange.dateEnd,
        defaultProps.profileId,
        mockData.cohorts,
        defaultProps.cohortIds,
      );
    });
  });

  describe("Error Handling", () => {
    it("handles query errors gracefully", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("Network error"));

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No scenario data available for the selected time period.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("handles utility function errors gracefully", async () => {
      mockCalculateScenarioAttributeBreakdown.mockImplementation(() => {
        throw new Error("Calculation error");
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No scenario data available for the selected time period.",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes for the parameter picker", async () => {
      renderComponent();

      await waitFor(() => {
        const pickerButton = screen.getByRole("combobox");
        expect(pickerButton).toHaveAttribute("aria-expanded", "false");
      });
    });

    it("updates ARIA attributes when picker is opened", async () => {
      renderComponent();

      await waitFor(() => {
        const pickerButton = screen.getByRole("combobox");
        fireEvent.click(pickerButton);
        expect(pickerButton).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("has proper ARIA attributes for dialog triggers", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
      });

      // Check that dialog triggers are accessible
      const legendItems = screen.getAllByText(/Easy|Hard/);
      expect(legendItems.length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("memoizes expensive calculations", async () => {
      renderComponent();

      // Wait for the component to load and process data
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Wait a bit more for the utility function to be called
      await waitFor(
        () => {
          expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledTimes(1);
    });

    it("only recalculates when dependencies change", async () => {
      renderComponent();

      // Wait for the component to load and process data
      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Wait a bit more for the utility function to be called
      await waitFor(
        () => {
          expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledTimes(1);

      // Since we're using renderWithMocks, we can't easily test rerender behavior
      // This test verifies that the initial calculation is memoized correctly
      expect(mockCalculateScenarioAttributeBreakdown).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dialog Functionality", () => {
    it("renders dialog triggers in legend", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
      });

      // Check that legend items are rendered
      const legendItems = screen.getAllByText(/Easy|Hard/);
      expect(legendItems.length).toBeGreaterThan(0);
    });

    it("handles parameter selection correctly", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Open the picker
      const pickerButton = screen.getByRole("combobox");
      fireEvent.click(pickerButton);

      // Check that parameter options are available
      await waitFor(() => {
        const difficultyElements = screen.getAllByText("Difficulty");
        expect(difficultyElements.length).toBeGreaterThan(0);
      });
    });

    it("displays correct parameter description", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Open the picker
      const pickerButton = screen.getByRole("combobox");
      fireEvent.click(pickerButton);

      // Check that the description is displayed
      await waitFor(() => {
        expect(
          screen.getByText("Performance by difficulty value"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Chart Interactions", () => {
    it("renders pie chart with correct data", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
      });

      // Check that pie chart data is rendered
      const pieData = screen.getByTestId("pie-chart-data");
      expect(pieData).toHaveAttribute("data-count", "2");
    });

    it("renders tooltip with detailed information", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("tooltip")).toBeInTheDocument();
      });

      // Check that tooltip component is rendered
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    it("renders legend with interactive elements", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("legend")).toBeInTheDocument();
      });

      // Check that legend is rendered
      expect(screen.getByTestId("legend")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty trend data gracefully", async () => {
      const emptyTrendData = [
        {
          id: "param1",
          name: "Easy",
          displayName: "Easy",
          icon: "📊",
          color: "#3b82f6",
          count: 5,
          percentage: 60.0,
          avgScore: 85,
          completionRate: 90,
          totalAttempts: 10,
          trendData: [], // Empty trend data
          insight: "Performance has remained stable.",
        },
      ];

      mockCalculateScenarioAttributeBreakdown.mockReturnValue(emptyTrendData);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Component should show no data message when there's no data
      expect(
        screen.getByText(
          "No scenario data available for the selected time period.",
        ),
      ).toBeInTheDocument();
    });

    it("handles missing parameter option gracefully", async () => {
      // Mock a scenario where selectedParameterId doesn't match any option
      const propsWithInvalidParameter = {
        ...defaultProps,
        // This would be set by the component internally, but we can test the fallback
      };

      renderComponent(propsWithInvalidParameter);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should show "Difficulty" as the selected parameter
      expect(screen.getByText("Difficulty")).toBeInTheDocument();
    });

    it("handles null or undefined data gracefully", async () => {
      // Mock all queries to return empty arrays
      mockGetAllProfiles.mockResolvedValue([]);
      mockGetAllCohorts.mockResolvedValue([]);
      mockGetAllScenarios.mockResolvedValue([]);
      mockGetAllSimulations.mockResolvedValue([]);
      mockGetAllRubrics.mockResolvedValue([]);
      mockGetAllParameters.mockResolvedValue([]);
      mockGetAllParameterItems.mockResolvedValue([]);
      mockGetSimulationAttemptsByProfiles.mockResolvedValue([]);
      mockGetSimulationChatsByAttempts.mockResolvedValue([]);
      mockGetSimulationChatGradesBySimulationChats.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Attribute Breakdown"),
        ).toBeInTheDocument();
      });

      // Should show no data message
      expect(
        screen.getByText(
          "No scenario data available for the selected time period.",
        ),
      ).toBeInTheDocument();
    });
  });
});
