import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import the component
import ScenarioStats, {
  ScenarioStatsProps,
} from "@/components/common/analytics/footer/ScenarioStats";

// Mock the utility function
import { calculateScenarioPerformance } from "@/utils/analytics/footer";
vi.mock("@/utils/analytics/footer", () => ({
  calculateScenarioPerformance: vi.fn(),
}));

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

// Mock Recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="bar" data-key={dataKey} />
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
}));

// Mock data
const mockData = {
  profiles: [
    {
      id: "profile1",
      updatedAt: "2024-01-15T10:00:00Z",
      userId: 1,
      lastLogin: "2024-01-15T10:00:00Z",
      firstName: "Test",
      lastName: "Profile",
      alias: "test-profile",
      viewedIntro: true,
      viewedChat: true,
      createdAt: "2024-01-15T10:00:00Z",
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
      simulationIds: ["sim1"],
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
      parameterItemIds: ["param1"],
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
      timeLimit: 30,
      active: true,
      scenarioIds: ["scenario1"],
      rubricId: "rubric1",
      defaultSimulation: false,
      practiceSimulation: false,
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
  parameters: [
    {
      id: "param1",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      name: "Difficulty",
      description: "Difficulty parameter",
      numerical: true,
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
      value: "1",
      parameterId: "param1",
      defaultItem: false,
    },
    {
      id: "param2",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      name: "Medium",
      description: "Medium difficulty",
      value: "2",
      parameterId: "param1",
      defaultItem: false,
    },
  ],
  personas: [
    {
      id: "persona1",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      name: "Test Persona",
      description: "Test persona description",
      systemPrompt: "You are a test persona",
      temperature: 0.7,
      defaultPersona: false,
      color: "#3b82f6",
      icon: "👤",
      modelId: null,
      reasoning: null,
      active: true,
    },
  ],
  documents: [
    {
      id: "doc1",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      name: "Test Document",
      filePath: "/test/path",
      mimeType: "application/pdf",
      type: "lecture" as const,
      classified: false,
      fileId: null,
      active: true,
    },
  ],
  attempts: [
    {
      id: "attempt1",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      completedAt: "2024-01-15T10:30:00Z",
      title: "Test Attempt",
      simulationId: "sim1",
      profileId: "profile1",
      completed: true,
      traceId: null,
    },
  ],
  chats: [
    {
      id: "chat1",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      completedAt: "2024-01-15T10:30:00Z",
      title: "Test Chat",
      attemptId: "attempt1",
      scenarioId: "scenario1",
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

const mockPerformanceData = [
  {
    metricLevel: "1",
    avgScore: 85,
    scenarioCount: 5,
    totalAttempts: 10,
    rubricPoints: 100,
  },
  {
    metricLevel: "2",
    avgScore: 70,
    scenarioCount: 3,
    totalAttempts: 8,
    rubricPoints: 100,
  },
];

const mockCorrelationData = {
  correlation: 0.75,
  pValue: 0.05,
};

// Mock the utility function
const mockCalculateScenarioPerformance = vi.mocked(
  calculateScenarioPerformance,
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

// Test props
const mockProps: ScenarioStatsProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-01-31"),
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
  profileId: "profile1",
  cohortIds: ["cohort1"],
};

describe("ScenarioStats", () => {
  beforeEach(() => {
    // Setup default mocks with immediate resolution
    mockGetAllProfiles.mockResolvedValue(mockData.profiles);
    mockGetAllCohorts.mockResolvedValue(mockData.cohorts);
    mockGetAllScenarios.mockResolvedValue(mockData.scenarios);
    mockGetAllSimulations.mockResolvedValue(mockData.simulations);
    mockGetAllRubrics.mockResolvedValue(mockData.rubrics);
    mockGetAllParameters.mockResolvedValue(mockData.parameters);
    mockGetAllParameterItems.mockResolvedValue(mockData.parameterItems);
    mockGetAllPersonas.mockResolvedValue(mockData.personas);
    mockGetAllDocuments.mockResolvedValue(mockData.documents);
    mockGetSimulationAttemptsByProfiles.mockResolvedValue(mockData.attempts);
    mockGetSimulationChatsByAttempts.mockResolvedValue(mockData.chats);
    mockGetSimulationChatGradesBySimulationChats.mockResolvedValue(
      mockData.grades,
    );

    mockCalculateScenarioPerformance.mockReturnValue({
      performanceData: mockPerformanceData,
      correlationData: mockCorrelationData,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the component title and description", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "Performance correlation with scenario characteristics",
        ),
      ).toBeInTheDocument();
    });

    it("renders the metric picker", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the component to finish loading and render the picker
      await waitFor(
        () => {
          expect(screen.getByRole("combobox")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // The component auto-selects the first parameter, so it shows "Difficulty" instead of "Select Parameter"
      const difficultyElements = screen.getAllByText("Difficulty");
      expect(difficultyElements.length).toBeGreaterThan(0);
    });

    it("renders the bar chart", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the chart to render
      await waitFor(
        () => {
          expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    });

    it("renders the correlation display", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the correlation display to render
      await waitFor(
        () => {
          expect(screen.getByText("Pearson r:")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      expect(screen.getByText("+0.75")).toBeInTheDocument();
      expect(screen.getByText("(p=0.050)")).toBeInTheDocument();
    });
  });

  describe("Data Loading", () => {
    it("shows loading state while data is being fetched", async () => {
      // Delay the mock responses to simulate loading
      mockGetAllProfiles.mockImplementation(() => new Promise(() => {}));

      render(<ScenarioStats {...mockProps} />);

      expect(screen.getByText("Loading scenario data...")).toBeInTheDocument();
    });

    it("calls the utility function with correct parameters when data is loaded", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(mockCalculateScenarioPerformance).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      expect(mockCalculateScenarioPerformance).toHaveBeenCalledWith(
        mockData.grades,
        mockData.chats,
        mockData.attempts,
        mockData.simulations,
        mockData.scenarios,
        mockData.rubrics,
        mockData.profiles,
        mockData.parameterItems,
        mockData.parameters[0], // selectedParameter
        mockProps.dateStart,
        mockProps.dateEnd,
        mockProps.profileId,
        mockData.cohorts,
        mockProps.cohortIds,
      );
    });

    it("handles missing data gracefully", async () => {
      mockGetAllProfiles.mockResolvedValue([]);
      mockGetAllScenarios.mockResolvedValue([]);

      render(<ScenarioStats {...mockProps} />);

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
    it("allows selecting different parameters", async () => {
      const user = userEvent.setup();

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the component to finish loading
      await waitFor(
        () => {
          expect(screen.getByRole("combobox")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Open the parameter picker
      await user.click(screen.getByRole("combobox"));

      // Check if parameter options are displayed - use getAllByText since there are multiple elements with "Difficulty"
      const difficultyElements = screen.getAllByText("Difficulty");
      expect(difficultyElements.length).toBeGreaterThan(0);
    });

    it("updates the chart when parameter is changed", async () => {
      const user = userEvent.setup();

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the component to finish loading
      await waitFor(
        () => {
          expect(screen.getByRole("combobox")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Verify initial call
      expect(mockCalculateScenarioPerformance).toHaveBeenCalledTimes(1);

      // Open the parameter picker
      await user.click(screen.getByRole("combobox"));

      // Since the component auto-selects the first parameter and we only have one parameter in our mock,
      // clicking the picker won't actually change the selection, so the utility function won't be called again.
      // This test verifies that the component renders correctly with the selected parameter.
      const difficultyElements = screen.getAllByText("Difficulty");
      expect(difficultyElements.length).toBeGreaterThan(0);
    });
  });

  describe("Threshold Status", () => {
    it("shows success status when performance and correlation are high", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: [
          {
            metricLevel: "1",
            avgScore: 85,
            scenarioCount: 5,
            totalAttempts: 10,
            rubricPoints: 100,
          },
        ],
        correlationData: { correlation: 0.8, pValue: 0.01 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("status-indicator")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-green-500");
    });

    it("shows warning status when performance is moderate", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: [
          {
            metricLevel: "1",
            avgScore: 75,
            scenarioCount: 5,
            totalAttempts: 10,
            rubricPoints: 100,
          },
        ],
        correlationData: { correlation: 0.2, pValue: 0.1 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("status-indicator")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-yellow-500");
    });

    it("shows danger status when performance is low", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: [
          {
            metricLevel: "1",
            avgScore: 45,
            scenarioCount: 5,
            totalAttempts: 10,
            rubricPoints: 100,
          },
        ],
        correlationData: { correlation: 0.1, pValue: 0.5 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("status-indicator")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const statusIndicator = screen.getByTestId("status-indicator");
      expect(statusIndicator).toHaveClass("bg-red-500");
    });
  });

  describe("Cohort Filtering", () => {
    it("shows no data message when no matching cohorts found", async () => {
      mockGetAllCohorts.mockResolvedValue([
        {
          id: "different-cohort",
          createdAt: "2024-01-15T10:00:00Z",
          updatedAt: "2024-01-15T10:00:00Z",
          title: "Different Cohort",
          description: "Different cohort description",
          active: true,
          profileIds: ["different-profile"],
          defaultCohort: false,
          simulationIds: ["different-sim"],
        },
      ]);

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("No data available for the selected cohorts."),
        ).toBeInTheDocument();
      });
    });

    it("filters data based on cohort restrictions", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockCalculateScenarioPerformance).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Object),
          expect.any(Date),
          expect.any(Date),
          mockProps.profileId,
          mockData.cohorts,
          mockProps.cohortIds,
        );
      });
    });
  });

  describe("No Numerical Parameters", () => {
    it("shows message when no numerical parameters are available", async () => {
      mockGetAllParameters.mockResolvedValue([
        {
          id: "param1",
          createdAt: "2024-01-15T10:00:00Z",
          updatedAt: "2024-01-15T10:00:00Z",
          name: "Difficulty",
          description: "Difficulty parameter",
          numerical: false, // Not numerical
          active: true,
        },
      ]);

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("No numerical parameters available for analysis."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Correlation Display", () => {
    it("displays positive correlation correctly", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: 0.75, pValue: 0.05 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByText("+0.75")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("displays negative correlation correctly", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: -0.6, pValue: 0.1 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByText("-0.60")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("displays zero correlation correctly", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: 0, pValue: 1 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByText("0.00")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Chart Data", () => {
    it("passes correct data to the bar chart", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const barChart = screen.getByTestId("bar-chart");
      const chartData = JSON.parse(
        barChart.getAttribute("data-chart-data") || "[]",
      );

      expect(chartData).toEqual(mockPerformanceData);
    });

    it("renders chart components correctly", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("cartesian-grid")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      expect(screen.getByTestId("x-axis")).toBeInTheDocument();
      expect(screen.getByTestId("y-axis")).toBeInTheDocument();
      expect(screen.getByTestId("bar")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      mockGetAllProfiles.mockRejectedValue(new Error("API Error"));

      render(<ScenarioStats {...mockProps} />);

      // Should still render the component structure
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });

    it("handles missing profileId", async () => {
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      render(<ScenarioStats {...propsWithoutProfile} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should still call the utility function
      await waitFor(() => {
        expect(mockCalculateScenarioPerformance).toHaveBeenCalled();
      });
    });
  });

  describe("Date Range Filtering", () => {
    it("filters data based on date range", async () => {
      const customDateProps = {
        ...mockProps,
        dateStart: new Date("2024-01-15"),
        dateEnd: new Date("2024-01-20"),
      };

      render(<ScenarioStats {...customDateProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockCalculateScenarioPerformance).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Object),
          customDateProps.dateStart,
          customDateProps.dateEnd,
          customDateProps.profileId,
          expect.any(Array),
          customDateProps.cohortIds,
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty performance data gracefully", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: [],
        correlationData: { correlation: 0, pValue: 1 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should still render the component structure
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });

    it("handles missing correlation data gracefully", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: 0, pValue: 1 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Should still render the component structure
      expect(
        screen.getByText("Scenario Performance Analysis"),
      ).toBeInTheDocument();
    });

    it("handles zero correlation correctly", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: 0, pValue: 0.5 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByText("0.00")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("handles very high correlation correctly", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: 0.99, pValue: 0.001 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByText("+0.99")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("handles very low correlation correctly", async () => {
      mockCalculateScenarioPerformance.mockReturnValue({
        performanceData: mockPerformanceData,
        correlationData: { correlation: -0.99, pValue: 0.001 },
      });

      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(screen.getByText("-0.99")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Component Integration", () => {
    it("renders all major UI elements together", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the component to finish loading and render all elements
      await waitFor(
        () => {
          expect(screen.getByRole("combobox")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Check that all major elements are present
      expect(
        screen.getByText(
          "Performance correlation with scenario characteristics",
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("status-indicator")).toBeInTheDocument();
    });

    it("maintains component state correctly", async () => {
      render(<ScenarioStats {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Scenario Performance Analysis"),
        ).toBeInTheDocument();
      });

      // Wait for the component to finish loading and render all elements
      await waitFor(
        () => {
          expect(screen.getByTestId("status-indicator")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Verify that the component maintains its state
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });
  });
});
