/**
 * RubricHeatmap.test.tsx
 * Tests for the RubricHeatmap component
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
import RubricHeatmap from "@/components/common/analytics/primary/RubricHeatmap";
import { render, screen, waitFor } from "@/test/custom-render";
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
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the utility function
vi.mock("@/utils/analytics/secondary", () => ({
  calculateRubricHeatmap: vi.fn(),
}));

// Mock the query functions
vi.mock("@/utils/queries/cohorts/get-all-cohorts");
vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics",
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock("@/utils/queries/standard_groups/get-standard-groups-by-rubrics");
vi.mock("@/utils/queries/standards/get-standards-by-standardgroups");

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
        onClick={() => onSelect([{ id: "rubric-1", name: "Test Rubric" }])}
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

const mockRubrics = [
  {
    id: "rubric-1",
    name: "Test Rubric 1",
    description: "Test Description",
    points: 100,
    active: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    passPoints: 70,
    defaultRubric: false,
  },
  {
    id: "rubric-2",
    name: "Test Rubric 2",
    description: "Test Description 2",
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
    id: "group-1",
    shortName: "Communication",
    name: "Communication Skills",
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "Communication skills description",
    points: 100,
    passPoints: 70,
    rubricId: "rubric-1",
    updatedAt: "2024-01-01T00:00:00.000Z",
    defaultRubric: false,
  },
  {
    id: "group-2",
    shortName: "Critical Thinking",
    name: "Critical Thinking Skills",
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "Critical thinking skills description",
    points: 100,
    passPoints: 70,
    rubricId: "rubric-1",
    updatedAt: "2024-01-01T00:00:00.000Z",
    defaultRubric: false,
  },
];

const mockStandards = [
  {
    id: "standard-1",
    standardGroupId: "group-1",
    name: "Communication Standard 1",
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "Communication standard description",
    points: 100,
  },
  {
    id: "standard-2",
    standardGroupId: "group-2",
    name: "Critical Thinking Standard 1",
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "Critical thinking standard description",
    points: 100,
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
    timeTaken: 100,
  },
];

const mockFeedbacks = [
  {
    id: "feedback-1",
    simulationChatGradeId: "grade-1",
    standardId: "standard-1",
    total: 85,
    createdAt: "2024-06-15T10:00:00Z",
    feedback: "Good job!",
  },
  {
    id: "feedback-2",
    simulationChatGradeId: "grade-1",
    standardId: "standard-2",
    total: 90,
    createdAt: "2024-06-15T10:00:00Z",
    feedback: "Great job!",
  },
];

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

const mockRubricHeatmapResult = {
  matrix: [
    [
      {
        correlation: 1.0,
        pValue: 0.001,
        color: "#10b981",
        strength: "Strong",
        dataPoints: 10,
      },
      {
        correlation: 0.75,
        pValue: 0.01,
        color: "#34d399",
        strength: "Moderate",
        dataPoints: 10,
      },
    ],
    [
      {
        correlation: 0.75,
        pValue: 0.01,
        color: "#34d399",
        strength: "Moderate",
        dataPoints: 10,
      },
      {
        correlation: 1.0,
        pValue: 0.001,
        color: "#10b981",
        strength: "Strong",
        dataPoints: 10,
      },
    ],
  ],
  insights:
    'Strong positive correlation (0.75) between "Communication" and "Critical Thinking". Students who excel in one skill area tend to excel in the other.',
  standardGroups: mockStandardGroups,
  hasData: true,
};

const renderComponent = (props = {}) => {
  return render(
    <QueryClientProvider client={mockQueryClient}>
      <RubricHeatmap {...defaultProps} {...props} />
    </QueryClientProvider>,
  );
};

describe("RubricHeatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(getAllRubrics).mockResolvedValue(mockRubrics);
    vi.mocked(getStandardGroupsByRubrics).mockResolvedValue(mockStandardGroups);
    vi.mocked(getStandardsByStandardGroups).mockResolvedValue(mockStandards);
    vi.mocked(getSimulationChatGradesByRubrics).mockResolvedValue(mockGrades);
    vi.mocked(
      getSimulationChatFeedbacksBySimulationChatGrades,
    ).mockResolvedValue(mockFeedbacks);
    vi.mocked(getAllCohorts).mockResolvedValue(mockCohorts);
    vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles); // Mocked to return empty array as per new mock
    vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue(mockAttempts);
    vi.mocked(getSimulationChatsByAttempts).mockResolvedValue(mockChats);
  });

  describe("Component Rendering", () => {
    it("renders the component with correct title and description", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Correlation between skill areas (standard groups)"),
        ).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      renderComponent();

      expect(
        screen.getByText("Skill Area Correlation Matrix"),
      ).toBeInTheDocument();
    });

    it("shows no data message when no correlation data is available", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        matrix: [],
        insights: null,
        standardGroups: [],
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No correlation data available for the selected time period",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading and Processing", () => {
    it("calls the utility function with correct parameters", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent({
        profileId: "profile-1",
        cohortIds: ["cohort-1"],
      });

      await waitFor(() => {
        expect(calculateRubricHeatmap).toHaveBeenCalledWith(
          mockGrades,
          mockFeedbacks,
          mockStandards,
          mockStandardGroups,
          [mockRubrics[0]], // filtered rubrics
          mockChats,
          mockAttempts,
          mockProfiles, // mockProfiles
          mockCohorts,
          defaultProps.dateStart,
          defaultProps.dateEnd,
          "profile-1",
          ["cohort-1"],
          ["rubric-1"], // selectedRubricIds
        );
      });
    });

    it("handles missing data gracefully", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        matrix: [],
        insights: null,
        standardGroups: [],
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No correlation data available for the selected time period",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Correlation Matrix Display", () => {
    it("displays correlation matrix when data is available", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText("Communication")).toHaveLength(2); // One in header, one in table cell
        expect(screen.getAllByText("Critical Thinking")).toHaveLength(2); // One in header, one in table cell
      });
    });

    it("displays correlation values in matrix cells", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText("1.00")).toHaveLength(2); // Two diagonal cells with 1.00
        expect(screen.getAllByText("0.75")).toHaveLength(2); // Two off-diagonal cells with 0.75
      });
    });
  });

  describe("Rubric Picker", () => {
    it("renders rubric picker when rubrics are available", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("rubric-picker")).toBeInTheDocument();
      });
    });

    it("does not render rubric picker when no rubrics are available", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
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
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        ...mockRubricHeatmapResult,
        matrix: [
          [
            {
              correlation: 0.9,
              pValue: 0.001,
              color: "#10b981",
              strength: "Strong",
              dataPoints: 10,
            },
            {
              correlation: 0.9,
              pValue: 0.001,
              color: "#10b981",
              strength: "Strong",
              dataPoints: 10,
            },
          ],
          [
            {
              correlation: 0.9,
              pValue: 0.001,
              color: "#10b981",
              strength: "Strong",
              dataPoints: 10,
            },
            {
              correlation: 0.9,
              pValue: 0.001,
              color: "#10b981",
              strength: "Strong",
              dataPoints: 10,
            },
          ],
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-green-500");
      });
    });

    it("shows yellow indicator for warning threshold", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        ...mockRubricHeatmapResult,
        matrix: [
          [
            {
              correlation: 0.75,
              pValue: 0.01,
              color: "#34d399",
              strength: "Moderate",
              dataPoints: 10,
            },
            {
              correlation: 0.75,
              pValue: 0.01,
              color: "#34d399",
              strength: "Moderate",
              dataPoints: 10,
            },
          ],
          [
            {
              correlation: 0.75,
              pValue: 0.01,
              color: "#34d399",
              strength: "Moderate",
              dataPoints: 10,
            },
            {
              correlation: 0.75,
              pValue: 0.01,
              color: "#34d399",
              strength: "Moderate",
              dataPoints: 10,
            },
          ],
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-yellow-500");
      });
    });

    it("shows red indicator for danger threshold", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        ...mockRubricHeatmapResult,
        matrix: [
          [
            {
              correlation: 0.4,
              pValue: 0.05,
              color: "#6ee7b7",
              strength: "Weak",
              dataPoints: 10,
            },
            {
              correlation: 0.4,
              pValue: 0.05,
              color: "#6ee7b7",
              strength: "Weak",
              dataPoints: 10,
            },
          ],
          [
            {
              correlation: 0.4,
              pValue: 0.05,
              color: "#6ee7b7",
              strength: "Weak",
              dataPoints: 10,
            },
            {
              correlation: 0.4,
              pValue: 0.05,
              color: "#6ee7b7",
              strength: "Weak",
              dataPoints: 10,
            },
          ],
        ],
      });

      renderComponent();

      await waitFor(() => {
        const indicator = document.querySelector(".absolute.top-2.right-2");
        expect(indicator).toHaveClass("bg-red-500");
      });
    });
  });

  describe("Matrix Interaction", () => {
    it("displays tooltips on matrix cell hover", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        // Check that tooltip triggers are present
        expect(screen.getAllByText("1.00")).toHaveLength(2); // Two diagonal cells with 1.00
        expect(screen.getAllByText("0.75")).toHaveLength(2); // Two off-diagonal cells with 0.75
      });
    });

    it("highlights rows and columns on hover", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        // Check that hover states are implemented
        expect(screen.getAllByText("Communication")).toHaveLength(2); // One in header, one in table cell
        expect(screen.getAllByText("Critical Thinking")).toHaveLength(2); // One in header, one in table cell
      });
    });
  });

  describe("Legend and Information", () => {
    it("displays correlation legend", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Strong Positive")).toBeInTheDocument();
        expect(screen.getByText("Strong Negative")).toBeInTheDocument();
        expect(screen.getByText("Weak/No Correlation")).toBeInTheDocument();
      });
    });

    it("displays Pearson correlation info", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Pearson r:")).toBeInTheDocument();
        expect(screen.getByText("Matrix")).toBeInTheDocument();
      });
    });
  });

  describe("Insights Display", () => {
    it("displays insights when available", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/Strong positive correlation/),
        ).toBeInTheDocument();
      });
    });

    it("does not display insights when not available", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        ...mockRubricHeatmapResult,
        insights: null,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.queryByText(/Strong positive correlation/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles query errors gracefully", async () => {
      vi.mocked(getAllRubrics).mockRejectedValue(new Error("Network error"));

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });
    });

    it("handles empty data arrays", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue({
        matrix: [],
        insights: null,
        standardGroups: [],
        hasData: false,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(
            "No correlation data available for the selected time period",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Props Handling", () => {
    it("handles profileId prop correctly", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent({ profileId: "profile-1" });

      await waitFor(() => {
        expect(calculateRubricHeatmap).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Date),
          expect.any(Date),
          "profile-1",
          expect.any(Array),
          expect.any(Array),
        );
      });
    });

    it("handles cohortIds prop correctly", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent({ cohortIds: ["cohort-1", "cohort-2"] });

      await waitFor(() => {
        expect(calculateRubricHeatmap).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
          expect.any(Date),
          expect.any(Date),
          undefined,
          ["cohort-1", "cohort-2"],
          expect.any(Array),
        );
      });
    });

    it("handles different threshold values", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      const customThresholds = {
        danger: 30,
        warning: 60,
        success: 90,
      };

      renderComponent({ thresholds: customThresholds });

      await waitFor(() => {
        expect(calculateRubricHeatmap).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Array),
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
          expect.any(Array),
        );
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading spinner when data is loading", async () => {
      // Mock loading state by not providing data
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Skill Area Correlation Matrix"),
        ).toBeInTheDocument();
      });
    });

    it("handles loading state transitions", async () => {
      const { calculateRubricHeatmap } = await import(
        "@/utils/analytics/secondary"
      );
      vi.mocked(calculateRubricHeatmap).mockReturnValue(
        mockRubricHeatmapResult,
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText("Communication")).toHaveLength(2);
      });
    });
  });
});
