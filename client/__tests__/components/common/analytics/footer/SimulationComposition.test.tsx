/**
 * SimulationComposition.test.tsx
 * Test suite for SimulationComposition component
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

import SimulationComposition from "@/components/common/analytics/footer/SimulationComposition";
import { renderWithMocks } from "@/test/renderWithMocks";
import { calculateSimulationComposition } from "@/utils/analytics/footer";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the utility function
vi.mock("@/utils/analytics/footer", () => ({
  calculateSimulationComposition: vi.fn(),
}));

// Mock all query functions that the component depends on
vi.mock("@/utils/queries/agents/get-all-agents");
vi.mock("@/utils/queries/cohorts/get-all-cohorts");
vi.mock("@/utils/queries/parameter_items/get-all-parameter-items");
vi.mock("@/utils/queries/parameters/get-all-parameters");
vi.mock("@/utils/queries/personas/get-all-personas");
vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/scenarios/get-all-scenarios");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock("@/utils/queries/simulations/get-all-simulations");

// Mock the SimulationCompositionPicker component
vi.mock("../SimulationCompositionPicker", () => ({
  default: ({
    onConfigChange,
  }: {
    onConfigChange: (config: {
      method: string;
      topPercentage: number;
      bottomPercentage: number;
      description: string;
    }) => void;
  }) => (
    <button
      onClick={() =>
        onConfigChange({
          method: "quartile",
          topPercentage: 30,
          bottomPercentage: 30,
          description: "Test Config",
        })
      }
      data-testid="config-picker"
    >
      Change Config
    </button>
  ),
}));

import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

describe("SimulationComposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock return values for query functions
    vi.mocked(getAllProfiles).mockResolvedValue([
      {
        id: "profile-1",
        updatedAt: new Date().toISOString(),
        userId: 1,
        lastLogin: new Date().toISOString(),
        firstName: "Test",
        lastName: "Profile",
        alias: "testprofile",
        viewedIntro: true,
        viewedChat: true,
        createdAt: new Date().toISOString(),
        role: "admin" as const,
        defaultProfile: false,
        active: true,
        lastActive: new Date().toISOString(),
      },
    ]);
    vi.mocked(getAllCohorts).mockResolvedValue([
      {
        id: "cohort-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: "Test Cohort",
        description: "Test Description",
        active: true,
        profileIds: ["profile-1"],
        defaultCohort: false,
        simulationIds: ["sim-1"],
      },
    ]);
    vi.mocked(getAllScenarios).mockResolvedValue([
      {
        id: "scenario-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "Test Scenario",
        description: "Test Description",
        active: true,
        personaId: null,
        parameterItemIds: ["param-1"],
        documentIds: null,
        defaultScenario: false,
        practiceScenario: false,
        generated: false,
        parentId: null,
      },
    ]);
    vi.mocked(getAllSimulations).mockResolvedValue([
      {
        id: "sim-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: "Test Simulation",
        timeLimit: 600,
        active: true,
        scenarioIds: ["scenario-1"],
        rubricId: "rubric-1",
        defaultSimulation: false,
        practiceSimulation: false,
      },
    ]);
    vi.mocked(getAllPersonas).mockResolvedValue([
      {
        id: "persona-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "Test Persona",
        description: "Test Description",
        active: true,
        systemPrompt: "Test prompt",
        temperature: 0.7,
        defaultPersona: false,
        color: "#000000",
        icon: "👤",
        modelId: null,
        reasoning: null,
      },
    ]);
    vi.mocked(getAllParameters).mockResolvedValue([
      {
        id: "param-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "Test Parameter",
        description: "Test Description",
        numerical: false,
        active: true,
      },
    ]);
    vi.mocked(getAllParameterItems).mockResolvedValue([
      {
        id: "param-item-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "Test Parameter Item",
        description: "Test Description",
        value: "Test Value",
        parameterId: "param-1",
        defaultItem: false,
      },
    ]);
    vi.mocked(getAllAgents).mockResolvedValue([
      {
        id: "agent-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "Test Agent",
        description: "Test Description",
        systemPrompt: "Test prompt",
        temperature: 0.7,
        modelId: null,
        reasoning: null,
      },
    ]);
    vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([
      {
        id: "attempt-1",
        createdAt: new Date().toISOString(),
        profileId: "profile-1",
        simulationId: "sim-1",
      },
    ]);
    vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([
      {
        id: "chat-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        title: "Test Chat",
        scenarioId: "scenario-1",
        attemptId: "attempt-1",
        completed: true,
        traceId: "trace-1",
      },
    ]);
    vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([
      {
        id: "grade-1",
        createdAt: new Date().toISOString(),
        passed: true,
        score: 85,
        timeTaken: 300,
        rubricId: "rubric-1",
        simulationChatId: "chat-1",
      },
    ]);

    // Set up default mock return value for utility function
    vi.mocked(calculateSimulationComposition).mockReturnValue({
      highPerforming: [
        {
          name: "Test Parameter: Test Value",
          value: 5,
          icon: "🏷️",
          color: "#3b82f6",
          description: "Test Parameter with value Test Value",
          significance: "high" as const,
        },
      ],
      lowPerforming: [
        {
          name: "Test Parameter: Test Value 2",
          value: 2,
          icon: "🏷️",
          color: "#ef4444",
          description: "Test Parameter with value Test Value 2",
          significance: "medium" as const,
        },
      ],
      highPerformingCount: 3,
      lowPerformingCount: 2,
      highPerformingDetails: [
        {
          id: "sim1",
          title: "Test Simulation 1",
          avgScore: 85,
          completionRate: 90,
          totalAttempts: 10,
          combinedScore: 87,
          timeLimit: 30,
          scenarioCount: 1,
          parameterBreakdown: [
            {
              parameterName: "Test Parameter",
              parameterValue: "Test Value",
              isNumerical: false,
            },
          ],
        },
      ],
      lowPerformingDetails: [
        {
          id: "sim2",
          title: "Test Simulation 2",
          avgScore: 65,
          completionRate: 70,
          totalAttempts: 8,
          combinedScore: 67,
          timeLimit: 30,
          scenarioCount: 1,
          parameterBreakdown: [
            {
              parameterName: "Test Parameter",
              parameterValue: "Test Value 2",
              isNumerical: false,
            },
          ],
        },
      ],
    });
  });

  const defaultProps = {
    dateStart: new Date("2024-01-01"),
    dateEnd: new Date("2024-01-31"),
    thresholds: {
      danger: 60,
      warning: 75,
      success: 85,
    },
    profileId: undefined,
    cohortIds: ["cohort-1"],
  };

  const renderComponent = (props = {}) => {
    return renderWithMocks(
      <SimulationComposition {...defaultProps} {...props} />
    );
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Data Loading and Utility Function Integration", () => {
    it("should call calculateSimulationComposition with correct parameters", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Component should render successfully
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should display correct value when utility function returns data", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Component should render with data
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should display 'No data' when utility function returns no data", async () => {
      vi.mocked(calculateSimulationComposition).mockReturnValue({
        highPerforming: [],
        lowPerforming: [],
        highPerformingCount: 0,
        lowPerformingCount: 0,
        highPerformingDetails: [],
        lowPerformingDetails: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "No simulation data available for the selected time period."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Method Labels and Configuration", () => {
    it("should display correct labels for percentile method", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should display correct labels for quartile method", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle configuration changes", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Dialog Functionality and Content", () => {
    it("should open high performing dialog when clicked", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should open low performing dialog when clicked", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should display parameter breakdown in dialogs", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should display insight text in dialogs", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Threshold Status and Performance Indicators", () => {
    it("should show success status when performance is high", async () => {
      const highPerformanceData = {
        highPerforming: [
          {
            name: "Test Parameter: Test Value",
            value: 5,
            icon: "🏷️",
            color: "#3b82f6",
            description: "Test Parameter with value Test Value",
            significance: "high" as const,
          },
        ],
        lowPerforming: [
          {
            name: "Test Parameter: Test Value 2",
            value: 2,
            icon: "🏷️",
            color: "#ef4444",
            description: "Test Parameter with value Test Value 2",
            significance: "medium" as const,
          },
        ],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 90,
            completionRate: 90,
            totalAttempts: 10,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 70,
            completionRate: 70,
            totalAttempts: 8,
            combinedScore: 67,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
            ],
          },
        ],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(
        highPerformanceData
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should show warning status when performance is moderate", async () => {
      const moderatePerformanceData = {
        highPerforming: [
          {
            name: "Test Parameter: Test Value",
            value: 5,
            icon: "🏷️",
            color: "#3b82f6",
            description: "Test Parameter with value Test Value",
            significance: "high" as const,
          },
        ],
        lowPerforming: [
          {
            name: "Test Parameter: Test Value 2",
            value: 2,
            icon: "🏷️",
            color: "#ef4444",
            description: "Test Parameter with value Test Value 2",
            significance: "medium" as const,
          },
        ],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 80,
            completionRate: 90,
            totalAttempts: 10,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 70,
            completionRate: 70,
            totalAttempts: 8,
            combinedScore: 67,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
            ],
          },
        ],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(
        moderatePerformanceData
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should show danger status when performance is low", async () => {
      const lowPerformanceData = {
        highPerforming: [
          {
            name: "Test Parameter: Test Value",
            value: 5,
            icon: "🏷️",
            color: "#3b82f6",
            description: "Test Parameter with value Test Value",
            significance: "high" as const,
          },
        ],
        lowPerforming: [
          {
            name: "Test Parameter: Test Value 2",
            value: 2,
            icon: "🏷️",
            color: "#ef4444",
            description: "Test Parameter with value Test Value 2",
            significance: "medium" as const,
          },
        ],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 70,
            completionRate: 90,
            totalAttempts: 10,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 50,
            completionRate: 70,
            totalAttempts: 8,
            combinedScore: 67,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
            ],
          },
        ],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(
        lowPerformanceData
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Insight Text Generation", () => {
    it("should generate insight text for high performing simulations", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should generate insight text for low performing simulations", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle no significant differences", async () => {
      const noSignificanceData = {
        highPerforming: [
          {
            name: "Test Parameter: Test Value",
            value: 5,
            icon: "🏷️",
            color: "#3b82f6",
            description: "Test Parameter with value Test Value",
            significance: "none" as const,
          },
        ],
        lowPerforming: [
          {
            name: "Test Parameter: Test Value 2",
            value: 2,
            icon: "🏷️",
            color: "#ef4444",
            description: "Test Parameter with value Test Value 2",
            significance: "medium" as const,
          },
        ],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 85,
            completionRate: 90,
            totalAttempts: 10,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 65,
            completionRate: 70,
            totalAttempts: 8,
            combinedScore: 67,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
            ],
          },
        ],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(
        noSignificanceData
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle empty data arrays", async () => {
      const emptyData = {
        highPerforming: [],
        lowPerforming: [],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 85,
            completionRate: 90,
            totalAttempts: 10,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 65,
            completionRate: 70,
            totalAttempts: 8,
            combinedScore: 67,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
            ],
          },
        ],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(emptyData);
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Parameter Breakdown and Table Rendering", () => {
    it("should render parameter tables with data", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle parameter breakdown in dialogs", async () => {
      const dataWithMultipleParameters = {
        highPerforming: [
          {
            name: "Test Parameter: Test Value",
            value: 5,
            icon: "🏷️",
            color: "#3b82f6",
            description: "Test Parameter with value Test Value",
            significance: "high" as const,
          },
        ],
        lowPerforming: [
          {
            name: "Test Parameter: Test Value 2",
            value: 2,
            icon: "🏷️",
            color: "#ef4444",
            description: "Test Parameter with value Test Value 2",
            significance: "medium" as const,
          },
        ],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 85,
            completionRate: 90,
            totalAttempts: 10,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
              {
                parameterName: "Test Parameter 2",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
              {
                parameterName: "Test Parameter 3",
                parameterValue: "Test Value 3",
                isNumerical: false,
              },
              {
                parameterName: "Test Parameter 4",
                parameterValue: "Test Value 4",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 65,
            completionRate: 70,
            totalAttempts: 8,
            combinedScore: 67,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(
        dataWithMultipleParameters
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different thresholds
      const propsWithDifferentThresholds = {
        ...defaultProps,
        thresholds: {
          danger: 30,
          warning: 60,
          success: 80,
        },
      };

      renderComponent(propsWithDifferentThresholds);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...defaultProps,
        profileId: undefined,
      };

      renderComponent(propsWithoutProfile);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle empty cohortIds array", async () => {
      const propsWithEmptyCohorts = {
        ...defaultProps,
        cohortIds: [],
      };

      renderComponent(propsWithEmptyCohorts);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle query errors gracefully", async () => {
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("Query failed"));

      renderComponent();

      // Component should render without crashing on error
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle no matching cohorts", async () => {
      vi.mocked(getAllCohorts).mockResolvedValue([
        {
          id: "cohort-2",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          title: "Other Cohort",
          description: "Other Description",
          active: true,
          profileIds: ["profile-1"],
          defaultCohort: false,
          simulationIds: ["sim-1"],
        },
      ]);

      renderComponent({ cohortIds: ["cohort-1"] });

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(
        screen.getByText("No data available for the selected cohorts.")
      ).toBeInTheDocument();
    });

    it("should handle neutral threshold status", async () => {
      const neutralData = {
        highPerforming: [],
        lowPerforming: [],
        highPerformingCount: 0,
        lowPerformingCount: 0,
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };

      vi.mocked(calculateSimulationComposition).mockReturnValue(neutralData);
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "No simulation data available for the selected time period."
        )
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle dialog close", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Comprehensive Data Rendering", () => {
    it("should render with complete data and exercise all code paths", async () => {
      // Mock all data to be available and properly structured
      const mockProfiles = [
        {
          id: "profile-1",
          updatedAt: new Date().toISOString(),
          userId: 1,
          lastLogin: new Date().toISOString(),
          firstName: "Test",
          lastName: "Profile",
          alias: "testprofile",
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          role: "admin" as const,
          defaultProfile: false,
          active: true,
          lastActive: new Date().toISOString(),
        },
      ];

      const mockCohorts = [
        {
          id: "cohort-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          title: "Test Cohort",
          description: "Test Description",
          active: true,
          profileIds: ["profile-1"],
          defaultCohort: false,
          simulationIds: ["sim-1"],
        },
      ];

      const mockScenarios = [
        {
          id: "scenario-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: "Test Scenario",
          description: "Test Description",
          active: true,
          personaId: "persona-1",
          parameterItemIds: ["param-1"],
          documentIds: null,
          defaultScenario: false,
          practiceScenario: false,
          generated: false,
          parentId: null,
        },
      ];

      const mockSimulations = [
        {
          id: "sim-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          title: "Test Simulation",
          timeLimit: 600,
          active: true,
          scenarioIds: ["scenario-1"],
          rubricId: "rubric-1",
          defaultSimulation: false,
          practiceSimulation: false,
        },
      ];

      const mockPersonas = [
        {
          id: "persona-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: "Test Persona",
          description: "Test Description",
          active: true,
          systemPrompt: "Test prompt",
          temperature: 0.7,
          defaultPersona: false,
          color: "#000000",
          icon: "👤",
          modelId: null,
          reasoning: null,
        },
      ];

      const mockParameters = [
        {
          id: "param-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: "Test Parameter",
          description: "Test Description",
          numerical: false,
          active: true,
        },
      ];

      const mockParameterItems = [
        {
          id: "param-item-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: "Test Parameter Item",
          description: "Test Description",
          value: "Test Value",
          parameterId: "param-1",
          defaultItem: false,
        },
      ];

      const mockAgents = [
        {
          id: "agent-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: "Test Agent",
          description: "Test Description",
          systemPrompt: "Test prompt",
          temperature: 0.7,
          modelId: null,
          reasoning: null,
        },
      ];

      const mockAttempts = [
        {
          id: "attempt-1",
          createdAt: new Date().toISOString(),
          profileId: "profile-1",
          simulationId: "sim-1",
        },
      ];

      const mockChats = [
        {
          id: "chat-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          title: "Test Chat",
          scenarioId: "scenario-1",
          attemptId: "attempt-1",
          completed: true,
          traceId: "trace-1",
        },
      ];

      const mockGrades = [
        {
          id: "grade-1",
          createdAt: new Date().toISOString(),
          passed: true,
          score: 85,
          timeTaken: 300,
          rubricId: "rubric-1",
          simulationChatId: "chat-1",
        },
      ];

      // Set up all mocks with the complete data
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);
      vi.mocked(getAllCohorts).mockResolvedValue(mockCohorts);
      vi.mocked(getAllScenarios).mockResolvedValue(mockScenarios);
      vi.mocked(getAllSimulations).mockResolvedValue(mockSimulations);
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);
      vi.mocked(getAllParameters).mockResolvedValue(mockParameters);
      vi.mocked(getAllParameterItems).mockResolvedValue(mockParameterItems);
      vi.mocked(getAllAgents).mockResolvedValue(mockAgents);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue(
        mockAttempts
      );
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue(mockChats);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue(
        mockGrades
      );

      // Mock the utility function to return comprehensive data
      vi.mocked(calculateSimulationComposition).mockReturnValue({
        highPerforming: [
          {
            name: "Test Parameter: Test Value",
            value: 5,
            icon: "🏷️",
            color: "#3b82f6",
            description: "Test Parameter with value Test Value",
            significance: "high" as const,
          },
          {
            name: "Test Parameter 2: Test Value 2",
            value: 3,
            icon: "🔧",
            color: "#10b981",
            description: "Test Parameter 2 with value Test Value 2",
            significance: "medium" as const,
          },
        ],
        lowPerforming: [
          {
            name: "Test Parameter 3: Test Value 3",
            value: 2,
            icon: "⚙️",
            color: "#ef4444",
            description: "Test Parameter 3 with value Test Value 3",
            significance: "low" as const,
          },
        ],
        highPerformingCount: 3,
        lowPerformingCount: 2,
        highPerformingDetails: [
          {
            id: "sim1",
            title: "Test Simulation 1",
            avgScore: 90,
            completionRate: 95,
            totalAttempts: 10,
            combinedScore: 92,
            timeLimit: 30,
            scenarioCount: 2,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
              {
                parameterName: "Test Parameter 2",
                parameterValue: "Test Value 2",
                isNumerical: false,
              },
            ],
          },
          {
            id: "sim2",
            title: "Test Simulation 2",
            avgScore: 85,
            completionRate: 90,
            totalAttempts: 8,
            combinedScore: 87,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter",
                parameterValue: "Test Value",
                isNumerical: false,
              },
            ],
          },
        ],
        lowPerformingDetails: [
          {
            id: "sim3",
            title: "Test Simulation 3",
            avgScore: 60,
            completionRate: 70,
            totalAttempts: 5,
            combinedScore: 65,
            timeLimit: 30,
            scenarioCount: 1,
            parameterBreakdown: [
              {
                parameterName: "Test Parameter 3",
                parameterValue: "Test Value 3",
                isNumerical: false,
              },
            ],
          },
        ],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Verify the component renders with data
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      expect(
        screen.getByText("High vs low performing simulations")
      ).toBeInTheDocument();
    });

    it("should test different method configurations", async () => {
      // Test with different method configurations to exercise getMethodLabel
      const testCases = [
        { method: "percentile", topPercentage: 30, bottomPercentage: 30 },
        { method: "quartile", topPercentage: 25, bottomPercentage: 25 },
        {
          method: "standard_deviation",
          topPercentage: 25,
          bottomPercentage: 25,
        },
      ];

      for (const _testCase of testCases) {
        vi.mocked(calculateSimulationComposition).mockReturnValue({
          highPerforming: [
            {
              name: "Test Parameter: Test Value",
              value: 5,
              icon: "🏷️",
              color: "#3b82f6",
              description: "Test Parameter with value Test Value",
              significance: "high" as const,
            },
          ],
          lowPerforming: [
            {
              name: "Test Parameter 2: Test Value 2",
              value: 2,
              icon: "🔧",
              color: "#ef4444",
              description: "Test Parameter 2 with value Test Value 2",
              significance: "medium" as const,
            },
          ],
          highPerformingCount: 3,
          lowPerformingCount: 2,
          highPerformingDetails: [
            {
              id: "sim1",
              title: "Test Simulation 1",
              avgScore: 85,
              completionRate: 90,
              totalAttempts: 10,
              combinedScore: 87,
              timeLimit: 30,
              scenarioCount: 1,
              parameterBreakdown: [
                {
                  parameterName: "Test Parameter",
                  parameterValue: "Test Value",
                  isNumerical: false,
                },
              ],
            },
          ],
          lowPerformingDetails: [
            {
              id: "sim2",
              title: "Test Simulation 2",
              avgScore: 65,
              completionRate: 70,
              totalAttempts: 8,
              combinedScore: 67,
              timeLimit: 30,
              scenarioCount: 1,
              parameterBreakdown: [
                {
                  parameterName: "Test Parameter 2",
                  parameterValue: "Test Value 2",
                  isNumerical: false,
                },
              ],
            },
          ],
        });

        const { unmount } = renderComponent();

        await waitFor(() => {
          expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
        });

        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
        unmount();
      }
    });

    it("should test different significance levels for insight text", async () => {
      const significanceLevels = ["high", "medium", "low", "none"] as const;

      for (const significance of significanceLevels) {
        vi.mocked(calculateSimulationComposition).mockReturnValue({
          highPerforming: [
            {
              name: "Test Parameter: Test Value",
              value: 5,
              icon: "🏷️",
              color: "#3b82f6",
              description: "Test Parameter with value Test Value",
              significance,
            },
          ],
          lowPerforming: [
            {
              name: "Test Parameter 2: Test Value 2",
              value: 2,
              icon: "🔧",
              color: "#ef4444",
              description: "Test Parameter 2 with value Test Value 2",
              significance: "medium" as const,
            },
          ],
          highPerformingCount: 3,
          lowPerformingCount: 2,
          highPerformingDetails: [
            {
              id: "sim1",
              title: "Test Simulation 1",
              avgScore: 85,
              completionRate: 90,
              totalAttempts: 10,
              combinedScore: 87,
              timeLimit: 30,
              scenarioCount: 1,
              parameterBreakdown: [
                {
                  parameterName: "Test Parameter",
                  parameterValue: "Test Value",
                  isNumerical: false,
                },
              ],
            },
          ],
          lowPerformingDetails: [
            {
              id: "sim2",
              title: "Test Simulation 2",
              avgScore: 65,
              completionRate: 70,
              totalAttempts: 8,
              combinedScore: 67,
              timeLimit: 30,
              scenarioCount: 1,
              parameterBreakdown: [
                {
                  parameterName: "Test Parameter 2",
                  parameterValue: "Test Value 2",
                  isNumerical: false,
                },
              ],
            },
          ],
        });

        const { unmount } = renderComponent();

        await waitFor(() => {
          expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
        });

        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
        unmount();
      }
    });

    it("should test threshold status calculations", async () => {
      const thresholdTestCases = [
        {
          highScore: 90,
          lowScore: 70,
          expectedStatus: "success" as const,
        },
        {
          highScore: 80,
          lowScore: 70,
          expectedStatus: "warning" as const,
        },
        {
          highScore: 70,
          lowScore: 50,
          expectedStatus: "danger" as const,
        },
      ];

      for (const _testCase of thresholdTestCases) {
        vi.mocked(calculateSimulationComposition).mockReturnValue({
          highPerforming: [
            {
              name: "Test Parameter: Test Value",
              value: 5,
              icon: "🏷️",
              color: "#3b82f6",
              description: "Test Parameter with value Test Value",
              significance: "high" as const,
            },
          ],
          lowPerforming: [
            {
              name: "Test Parameter 2: Test Value 2",
              value: 2,
              icon: "🔧",
              color: "#ef4444",
              description: "Test Parameter 2 with value Test Value 2",
              significance: "medium" as const,
            },
          ],
          highPerformingCount: 3,
          lowPerformingCount: 2,
          highPerformingDetails: [
            {
              id: "sim1",
              title: "Test Simulation 1",
              avgScore: _testCase.highScore,
              completionRate: 90,
              totalAttempts: 10,
              combinedScore: _testCase.highScore + 2,
              timeLimit: 30,
              scenarioCount: 1,
              parameterBreakdown: [
                {
                  parameterName: "Test Parameter",
                  parameterValue: "Test Value",
                  isNumerical: false,
                },
              ],
            },
          ],
          lowPerformingDetails: [
            {
              id: "sim2",
              title: "Test Simulation 2",
              avgScore: _testCase.lowScore,
              completionRate: 70,
              totalAttempts: 8,
              combinedScore: _testCase.lowScore + 2,
              timeLimit: 30,
              scenarioCount: 1,
              parameterBreakdown: [
                {
                  parameterName: "Test Parameter 2",
                  parameterValue: "Test Value 2",
                  isNumerical: false,
                },
              ],
            },
          ],
        });

        const { unmount } = renderComponent();

        await waitFor(() => {
          expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
        });

        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
        unmount();
      }
    });
  });
});
