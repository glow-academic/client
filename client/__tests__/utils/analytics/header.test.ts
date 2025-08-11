import type {
  Cohort,
  Rubric,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
  SimulationMessage,
} from "@/types";
import {
  calculateAverageScore,
  calculateCompletionPercentage,
  calculateFirstAttemptPassRate,
  calculateHighestScore,
  calculateMessagesPerSession,
  calculatePersonaResponseTimes,
  calculateSessionEfficiency,
  calculateStagnationRate,
  calculateTimeSpent,
  calculateTotalAttempts,
} from "@/utils/analytics/header";
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

const mockMessage: SimulationMessage = {
  id: "msg-1",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z",
  chatId: "chat-1",
  content: "Test message",
  type: "query",
  completed: true,
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

const dateStart = new Date("2024-01-01");
const dateEnd = new Date("2024-01-31");

describe("Analytics Header Utilities", () => {
  describe("calculateAverageScore", () => {
    it("should calculate average score correctly", () => {
      const result = calculateAverageScore(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(85); // 85/100 * 100 = 85%
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31); // 31 days in January
    });

    it("should return no data when no grades exist", () => {
      const result = calculateAverageScore(
        [],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(false);
    });

    it("should filter by profile ID correctly", () => {
      const result = calculateAverageScore(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "different-profile"
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(false);
    });
  });

  describe("calculateCompletionPercentage", () => {
    it("should calculate completion percentage correctly", () => {
      const result = calculateCompletionPercentage(
        [mockChat],
        [mockGrade],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(100); // 1 passed chat out of 1 total
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle failed attempts", () => {
      const failedGrade = { ...mockGrade, passed: false };
      const result = calculateCompletionPercentage(
        [mockChat],
        [failedGrade],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0); // 0 passed chats out of 1 total
      expect(result.hasData).toBe(true);
    });
  });

  describe("calculateFirstAttemptPassRate", () => {
    it("should calculate first attempt pass rate correctly", () => {
      const result = calculateFirstAttemptPassRate(
        [mockAttempt],
        [mockChat],
        [mockGrade],
        [mockSimulation],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(100); // 1 passed first attempt out of 1 total
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle multiple attempts for same simulation", () => {
      const secondAttempt = {
        ...mockAttempt,
        id: "attempt-2",
        createdAt: "2024-01-16T10:00:00Z",
      };
      const result = calculateFirstAttemptPassRate(
        [mockAttempt, secondAttempt],
        [mockChat],
        [mockGrade],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(100); // Should only count first attempt
      expect(result.hasData).toBe(true);
    });
  });

  describe("calculateHighestScore", () => {
    it("should calculate highest score correctly", () => {
      const result = calculateHighestScore(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(85); // 85/100 * 100 = 85%
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle multiple grades and return highest", () => {
      const higherGrade = { ...mockGrade, id: "grade-2", score: 95 };
      const result = calculateHighestScore(
        [mockGrade, higherGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(95); // Should return highest score
      expect(result.hasData).toBe(true);
    });
  });

  describe("calculateMessagesPerSession", () => {
    it("should calculate messages per session correctly", () => {
      const result = calculateMessagesPerSession(
        [mockMessage],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(1); // 1 message in 1 session
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle multiple messages per session", () => {
      const secondMessage = { ...mockMessage, id: "msg-2" };
      const result = calculateMessagesPerSession(
        [mockMessage, secondMessage],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(2); // 2 messages in 1 session
      expect(result.hasData).toBe(true);
    });
  });

  describe("calculatePersonaResponseTimes", () => {
    it("should calculate response times correctly", () => {
      const responseMessage = {
        ...mockMessage,
        id: "msg-2",
        type: "response" as const,
        createdAt: "2024-01-15T10:05:00Z",
      };
      const result = calculatePersonaResponseTimes(
        [mockMessage, responseMessage],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(300); // 5 minutes = 300 seconds
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle no response pairs", () => {
      const result = calculatePersonaResponseTimes(
        [mockMessage],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(true);
    });
  });

  describe("calculateSessionEfficiency", () => {
    it("should calculate session efficiency correctly", () => {
      const result = calculateSessionEfficiency(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      // Efficiency = (Average Score %) / (Average Time per Session in minutes)
      // Score = 85%, Time = 30 minutes = 1800 seconds
      // Efficiency = 85 / 30 ≈ 2.83
      expect(result.currentValue).toBeGreaterThanOrEqual(0);
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle no data", () => {
      const result = calculateSessionEfficiency(
        [],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(false);
    });
  });

  describe("calculateStagnationRate", () => {
    it("should calculate stagnation rate correctly", () => {
      const result = calculateStagnationRate(
        [mockAttempt],
        [mockChat],
        [mockGrade],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBeGreaterThanOrEqual(0);
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle no data", () => {
      const result = calculateStagnationRate(
        [],
        [mockChat],
        [mockGrade],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(false);
    });
  });

  describe("calculateTimeSpent", () => {
    it("should calculate time spent correctly", () => {
      const result = calculateTimeSpent(
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(1800); // 30 minutes = 1800 seconds
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle incomplete sessions", () => {
      const incompleteChat = {
        ...mockChat,
        completed: false,
        completedAt: null,
      };
      const result = calculateTimeSpent(
        [incompleteChat],
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0); // Incomplete sessions don't count
      expect(result.hasData).toBe(true);
    });
  });

  describe("calculateTotalAttempts", () => {
    it("should calculate total attempts correctly", () => {
      const result = calculateTotalAttempts(
        [mockAttempt],
        [mockSimulation],
        dateStart,
        dateEnd,
        "profile-1",
        [mockCohort],
        ["cohort-1"]
      );

      expect(result.currentValue).toBe(1);
      expect(result.hasData).toBe(true);
      expect(result.trendData).toHaveLength(31);
    });

    it("should handle multiple attempts", () => {
      const secondAttempt = {
        ...mockAttempt,
        id: "attempt-2",
        createdAt: "2024-01-16T10:00:00Z",
      };
      const result = calculateTotalAttempts(
        [mockAttempt, secondAttempt],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(2);
      expect(result.hasData).toBe(true);
    });

    it("should exclude practice simulations", () => {
      const practiceSimulation = {
        ...mockSimulation,
        practiceSimulation: true,
      };
      const result = calculateTotalAttempts(
        [mockAttempt],
        [practiceSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty arrays gracefully", () => {
      const result = calculateAverageScore(
        [],
        [],
        [],
        [],
        [],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0);
      expect(result.hasData).toBe(false);
      expect(result.trendData).toHaveLength(0); // No trend data when no data exists
    });

    it("should handle date filtering correctly", () => {
      const futureAttempt = {
        ...mockAttempt,
        createdAt: "2024-02-01T10:00:00Z",
      };
      const result = calculateTotalAttempts(
        [futureAttempt],
        [mockSimulation],
        dateStart,
        dateEnd
      );

      expect(result.currentValue).toBe(0); // Outside date range
      expect(result.hasData).toBe(false);
    });

    it("should handle cohort filtering correctly", () => {
      const differentCohort = {
        ...mockCohort,
        id: "cohort-2",
        profileIds: ["different-profile"],
      };
      const result = calculateAverageScore(
        [mockGrade],
        [mockChat],
        [mockAttempt],
        [mockSimulation],
        [mockRubric],
        dateStart,
        dateEnd,
        "profile-1",
        [differentCohort],
        ["cohort-2"]
      );

      expect(result.currentValue).toBe(0); // Profile not in cohort
      expect(result.hasData).toBe(false);
    });
  });
});
