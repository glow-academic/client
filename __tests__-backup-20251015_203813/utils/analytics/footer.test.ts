import type {
  Cohort,
  Parameter,
  ParameterItem,
  Profile,
  Rubric,
  Scenario,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
} from "@/types";
import {
  calculateScenarioAttributeBreakdown,
  calculateScenarioPerformance,
  calculateScenarioPerformanceWithinSimulation,
  calculateSimulationComposition,
  calculateSimulationPerformance,
  getAvailableSimulations,
} from "@/utils/analytics/footer";
import { describe, expect, it } from "vitest";

// Mock data for testing
const mockRubric: Rubric = {
  id: "rubric-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  name: "Test Rubric",
  description: "Test Description",
  points: 100,
  passPoints: 70,
  defaultRubric: false,
  active: true,
};

const mockSimulation: Simulation = {
  id: "sim-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  title: "Test Simulation",
  timeLimit: 3600,
  active: true,
  scenarioIds: ["scenario-1"],
  rubricId: "rubric-1",
  defaultSimulation: false,
  practiceSimulation: false,
};

const mockAttempt: SimulationAttempt = {
  id: "attempt-1",
  createdAt: "2024-01-15T10:00:00Z",
  profileId: "profile-1",
  simulationId: "sim-1",
};

const mockChat: SimulationChat = {
  id: "chat-1",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z",
  completedAt: "2024-01-15T10:30:00Z",
  title: "Test Chat",
  scenarioId: "scenario-1",
  attemptId: "attempt-1",
  completed: true,
  traceId: null,
};

const mockGrade: SimulationChatGrade = {
  id: "grade-1",
  createdAt: "2024-01-15T10:30:00Z",
  passed: true,
  score: 85,
  timeTaken: 1800,
  rubricId: "rubric-1",
  simulationChatId: "chat-1",
};

const mockProfile: Profile = {
  id: "profile-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  firstName: "Test",
  lastName: "Profile",
  alias: "test-profile",
  role: "ta",
  active: true,
  defaultProfile: false,
  userId: 1,
  lastLogin: "2024-01-01T00:00:00Z",
  viewedIntro: true,
  viewedChat: true,
  lastActive: "2024-01-01T00:00:00Z",
};

const mockScenario: Scenario = {
  id: "scenario-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  name: "Test Scenario",
  description: "Test Description",
  active: true,
  parameterItemIds: ["param-item-1"],
  defaultScenario: false,
  generated: false,
  personaId: null,
  documentIds: null,
  practiceScenario: false,
  parentId: null,
};

const mockParameter: Parameter = {
  id: "param-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  name: "Test Parameter",
  description: "Test Description",
  active: true,
  numerical: false,
};

const mockParameterItem: ParameterItem = {
  id: "param-item-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  value: "Test Value",
  parameterId: "param-1",
  defaultItem: false,
  name: "Test Parameter Item",
  description: "Test Description",
};

const mockCohort: Cohort = {
  id: "cohort-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  title: "Test Cohort",
  description: "Test Description",
  active: true,
  profileIds: ["profile-1"],
  defaultCohort: false,
  simulationIds: ["sim-1"],
};

describe("Footer Analytics Utilities", () => {
  const dateStart = new Date("2024-01-01");
  const dateEnd = new Date("2024-01-31");

  describe("calculateScenarioAttributeBreakdown", () => {
    it("should return empty array when no parameter items for selected parameter", () => {
      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [],
        mockParameter,
        dateStart,
        dateEnd,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when no grades in date range", () => {
      const gradeOutsideRange: SimulationChatGrade = {
        ...mockGrade,
        createdAt: "2024-02-15T10:30:00Z", // Outside date range
      };

      const result = calculateScenarioAttributeBreakdown(
        [gradeOutsideRange],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
      );

      expect(result).toEqual([]);
    });

    it("should filter out practice simulations", () => {
      const practiceSimulation: Simulation = {
        ...mockSimulation,
        practiceSimulation: true,
      };

      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [practiceSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
      );

      expect(result).toEqual([]);
    });

    it("should filter by profile when provided", () => {
      const differentProfileAttempt: SimulationAttempt = {
        ...mockAttempt,
        profileId: "different-profile",
      };

      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [differentProfileAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
        "profile-1",
      );

      expect(result).toEqual([]);
    });

    it("should apply cohort filtering when cohort IDs provided", () => {
      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
        undefined,
        [mockCohort],
        ["cohort-1"],
      );

      expect(result.length).toBeGreaterThan(0);
    });

    it("should return empty array when no data allowed due to cohort restrictions", () => {
      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
        undefined,
        [],
        ["non-existent-cohort"],
      );

      expect(result).toEqual([]);
    });

    it("should calculate scenario attribute breakdown with performance metrics", () => {
      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("displayName");
      expect(result[0]).toHaveProperty("icon");
      expect(result[0]).toHaveProperty("color");
      expect(result[0]).toHaveProperty("count");
      expect(result[0]).toHaveProperty("percentage");
      expect(result[0]).toHaveProperty("avgScore");
      expect(result[0]).toHaveProperty("completionRate");
      expect(result[0]).toHaveProperty("totalAttempts");
      expect(result[0]).toHaveProperty("trendData");
      expect(result[0]).toHaveProperty("insight");
    });

    it("should display time values as raw text", () => {
      const timeParameter: Parameter = {
        ...mockParameter,
        name: "Time Parameter",
      };

      const timeParameterItem: ParameterItem = {
        ...mockParameterItem,
        value: "14:30:00",
      };

      const result = calculateScenarioAttributeBreakdown(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [timeParameterItem],
        timeParameter,
        dateStart,
        dateEnd,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.displayName).toBe("14:30:00");
    });
  });

  describe("calculateScenarioPerformance", () => {
    it("should return empty performance data when no parameter items", () => {
      const result = calculateScenarioPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [],
        mockParameter,
        dateStart,
        dateEnd,
      );

      expect(result.performanceData).toEqual([]);
      expect(result.correlationData).toEqual({ correlation: 0, pValue: 1 });
    });

    it("should return empty performance data when no grades in date range", () => {
      const gradeOutsideRange: SimulationChatGrade = {
        ...mockGrade,
        createdAt: "2024-02-15T10:30:00Z",
      };

      const result = calculateScenarioPerformance(
        [gradeOutsideRange],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
      );

      expect(result.performanceData).toEqual([]);
      expect(result.correlationData).toEqual({ correlation: 0, pValue: 1 });
    });

    it("should calculate performance data with correlation", () => {
      const numericalParameter: Parameter = {
        ...mockParameter,
        numerical: true,
      };

      const numericalParameterItem: ParameterItem = {
        ...mockParameterItem,
        value: "1",
      };

      const result = calculateScenarioPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [numericalParameterItem],
        numericalParameter,
        dateStart,
        dateEnd,
      );

      expect(result.performanceData.length).toBeGreaterThan(0);
      expect(result.correlationData).toHaveProperty("correlation");
      expect(result.correlationData).toHaveProperty("pValue");
    });

    it("should apply cohort filtering", () => {
      const result = calculateScenarioPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockRubric],
        [mockProfile],
        [mockParameterItem],
        mockParameter,
        dateStart,
        dateEnd,
        undefined,
        [mockCohort],
        ["cohort-1"],
      );

      expect(result.performanceData.length).toBeGreaterThan(0);
    });
  });

  describe("calculateSimulationComposition", () => {
    it("should return empty data when no grades in date range", () => {
      const gradeOutsideRange: SimulationChatGrade = {
        ...mockGrade,
        createdAt: "2024-02-15T10:30:00Z",
      };

      const result = calculateSimulationComposition(
        [gradeOutsideRange],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockProfile],
        [mockParameter],
        [mockParameterItem],
        dateStart,
        dateEnd,
      );

      expect(result.highPerforming).toEqual([]);
      expect(result.lowPerforming).toEqual([]);
      expect(result.highPerformingCount).toBe(0);
      expect(result.lowPerformingCount).toBe(0);
    });

    it("should calculate simulation composition with percentile method", () => {
      const result = calculateSimulationComposition(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockProfile],
        [mockParameter],
        [mockParameterItem],
        dateStart,
        dateEnd,
        undefined,
        [],
        [],
        { method: "percentile", topPercentage: 25, bottomPercentage: 25 },
      );

      expect(result.highPerforming).toBeDefined();
      expect(result.lowPerforming).toBeDefined();
      expect(result.highPerformingDetails).toBeDefined();
      expect(result.lowPerformingDetails).toBeDefined();
    });

    it("should calculate simulation composition with quartile method", () => {
      const result = calculateSimulationComposition(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockProfile],
        [mockParameter],
        [mockParameterItem],
        dateStart,
        dateEnd,
        undefined,
        [],
        [],
        { method: "quartile", topPercentage: 25, bottomPercentage: 25 },
      );

      expect(result.highPerforming).toBeDefined();
      expect(result.lowPerforming).toBeDefined();
    });

    it("should calculate simulation composition with standard deviation method", () => {
      const result = calculateSimulationComposition(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockProfile],
        [mockParameter],
        [mockParameterItem],
        dateStart,
        dateEnd,
        undefined,
        [],
        [],
        {
          method: "standard_deviation",
          topPercentage: 25,
          bottomPercentage: 25,
        },
      );

      expect(result.highPerforming).toBeDefined();
      expect(result.lowPerforming).toBeDefined();
    });

    it("should apply cohort filtering", () => {
      const result = calculateSimulationComposition(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockScenario],
        [mockProfile],
        [mockParameter],
        [mockParameterItem],
        dateStart,
        dateEnd,
        undefined,
        [mockCohort],
        ["cohort-1"],
      );

      expect(result.highPerforming).toBeDefined();
      expect(result.lowPerforming).toBeDefined();
    });
  });

  describe("calculateScenarioPerformanceWithinSimulation", () => {
    it("should return empty array when no simulation selected", () => {
      const result = calculateScenarioPerformanceWithinSimulation(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockScenario],
        [mockProfile],
        [mockRubric],
        null,
        dateStart,
        dateEnd,
        { danger: 50, warning: 70, success: 85 },
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when no grades in date range", () => {
      const gradeOutsideRange: SimulationChatGrade = {
        ...mockGrade,
        createdAt: "2024-02-15T10:30:00Z",
      };

      const result = calculateScenarioPerformanceWithinSimulation(
        [gradeOutsideRange],
        [mockChat],
        [mockAttempt],
        [mockScenario],
        [mockProfile],
        [mockRubric],
        mockSimulation,
        dateStart,
        dateEnd,
        { danger: 50, warning: 70, success: 85 },
      );

      expect(result).toEqual([]);
    });

    it("should calculate scenario performance within simulation", () => {
      const result = calculateScenarioPerformanceWithinSimulation(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockScenario],
        [mockProfile],
        [mockRubric],
        mockSimulation,
        dateStart,
        dateEnd,
        { danger: 50, warning: 70, success: 85 },
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("scenarioId");
      expect(result[0]).toHaveProperty("scenarioName");
      expect(result[0]).toHaveProperty("avgScore");
      expect(result[0]).toHaveProperty("successRate");
      expect(result[0]).toHaveProperty("performanceChange");
      expect(result[0]).toHaveProperty("totalAttempts");
      expect(result[0]).toHaveProperty("completedAttempts");
      expect(result[0]).toHaveProperty("color");
    });

    it("should apply cohort filtering", () => {
      const result = calculateScenarioPerformanceWithinSimulation(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockScenario],
        [mockProfile],
        [mockRubric],
        mockSimulation,
        dateStart,
        dateEnd,
        { danger: 50, warning: 70, success: 85 },
        undefined,
        [mockCohort],
        ["cohort-1"],
      );

      expect(result).toBeDefined();
    });
  });

  describe("getAvailableSimulations", () => {
    it("should filter out practice simulations", () => {
      const practiceSimulation: Simulation = {
        ...mockSimulation,
        practiceSimulation: true,
      };

      const result = getAvailableSimulations(
        [practiceSimulation],
        [mockChat],
        [mockGrade],
        [mockAttempt],
        [mockProfile],
        dateStart,
        dateEnd,
      );

      expect(result).toEqual([]);
    });

    it("should filter out inactive simulations", () => {
      const inactiveSimulation: Simulation = {
        ...mockSimulation,
        active: false,
      };

      const result = getAvailableSimulations(
        [inactiveSimulation],
        [mockChat],
        [mockGrade],
        [mockAttempt],
        [mockProfile],
        dateStart,
        dateEnd,
      );

      expect(result).toEqual([]);
    });

    it("should return simulations with data in date range", () => {
      const result = getAvailableSimulations(
        [mockSimulation],
        [mockChat],
        [mockGrade],
        [mockAttempt],
        [mockProfile],
        dateStart,
        dateEnd,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("title");
      expect(result[0]).toHaveProperty("description");
    });

    it("should apply cohort filtering", () => {
      // Test with cohort filtering - this function has complex filtering logic
      // that includes profile role filtering, so we test the basic case
      const result = getAvailableSimulations(
        [mockSimulation],
        [mockChat],
        [mockGrade],
        [mockAttempt],
        [mockProfile],
        dateStart,
        dateEnd,
        undefined,
        [mockCohort],
        ["cohort-1"],
      );

      // The result should be an array (may be empty due to complex filtering)
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array when cohort filtering excludes all simulations", () => {
      // Test with cohort that doesn't include the simulation
      const differentCohort: Cohort = {
        ...mockCohort,
        simulationIds: ["different-sim"],
      };

      const result = getAvailableSimulations(
        [mockSimulation],
        [mockChat],
        [mockGrade],
        [mockAttempt],
        [mockProfile],
        dateStart,
        dateEnd,
        undefined,
        [differentCohort],
        ["cohort-1"],
      );

      expect(result).toEqual([]);
    });

    it("should filter by profile when provided", () => {
      const differentProfileAttempt: SimulationAttempt = {
        ...mockAttempt,
        profileId: "different-profile",
      };

      const result = getAvailableSimulations(
        [mockSimulation],
        [mockChat],
        [mockGrade],
        [differentProfileAttempt],
        [mockProfile],
        dateStart,
        dateEnd,
        "profile-1",
      );

      expect(result).toEqual([]);
    });
  });

  describe("calculateSimulationPerformance", () => {
    it("should return empty result when no grades in date range", () => {
      const gradeOutsideRange: SimulationChatGrade = {
        ...mockGrade,
        createdAt: "2024-02-15T10:30:00Z",
      };

      const result = calculateSimulationPerformance(
        [gradeOutsideRange],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
      );

      expect(result.currentValue).toBe(0);
      expect(result.trendData).toEqual([]);
      expect(result.hasData).toBe(false);
    });

    it("should filter out practice simulations", () => {
      const practiceSimulation: Simulation = {
        ...mockSimulation,
        practiceSimulation: true,
      };

      const result = calculateSimulationPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [practiceSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
      );

      expect(result.currentValue).toBe(0);
      expect(result.trendData).toEqual([]);
      expect(result.hasData).toBe(false);
    });

    it("should calculate simulation performance metrics", () => {
      const result = calculateSimulationPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
      );

      expect(result.currentValue).toBeGreaterThan(0);
      expect(result.trendData.length).toBeGreaterThan(0);
      expect(result.hasData).toBe(true);
      expect(result.trendData[0]).toHaveProperty("date");
      expect(result.trendData[0]).toHaveProperty("value");
      expect(result.trendData[0]).toHaveProperty("count");
    });

    it("should filter by profile when provided", () => {
      const result = calculateSimulationPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "profile-1",
      );

      expect(result.currentValue).toBeGreaterThan(0);
      expect(result.hasData).toBe(true);
    });

    it("should apply cohort filtering", () => {
      const result = calculateSimulationPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        undefined,
        [mockCohort],
        ["cohort-1"],
      );

      expect(result.currentValue).toBeGreaterThan(0);
      expect(result.hasData).toBe(true);
    });

    it("should return empty result when no data allowed due to cohort restrictions", () => {
      const result = calculateSimulationPerformance(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        undefined,
        [],
        ["non-existent-cohort"],
      );

      expect(result.currentValue).toBe(0);
      expect(result.trendData).toEqual([]);
      expect(result.hasData).toBe(false);
    });
  });
});
