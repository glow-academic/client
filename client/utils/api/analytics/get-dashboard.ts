import { api } from "@/lib/api/fetcher";

export type SimulationFilter = "general" | "practice" | "archived";

export type AnalyticsFilters = {
  startDate: string;
  endDate: string;
  cohortIds?: string[];
  roles?: string[];
  simulationFilters?: SimulationFilter[];
  profileId?: string;
};

// Function name union
export type DashboardFunctionName =
  // Header
  | "calculateAverageScore"
  | "calculateCompletionPercentage"
  | "calculateFirstAttemptPassRate"
  | "calculateHighestScore"
  | "calculateUserSimulationPerformance"
  | "calculateUserPerformanceBySimulation"
  | "calculateMessagesPerSession"
  | "calculatePersonaResponseTimes"
  | "calculateSessionEfficiency"
  | "calculateStagnationRate"
  | "calculateTimeSpent"
  | "calculateTotalAttempts"
  // Footer
  | "calculateScenarioAttributeBreakdown"
  | "calculateScenarioPerformance"
  | "calculateSimulationComposition"
  | "calculateScenarioPerformanceWithinSimulation"
  | "calculateSimulationPerformance"
  // Primary
  | "calculateAttemptImprovement"
  | "calculatePlatformGrowth"
  | "calculatePersonaPerformance"
  // Secondary
  | "calculateCohortPerformance"
  | "calculateSkillPerformance"
  | "calculateRubricHeatmap";

// Arg schemas per function
export type DashboardFunctionArgs =
  | { name: "calculateAverageScore"; args?: object }
  | { name: "calculateCompletionPercentage"; args?: object }
  | { name: "calculateFirstAttemptPassRate"; args?: object }
  | { name: "calculateHighestScore"; args?: object }
  | {
      name: "calculateUserSimulationPerformance";
      args: { profileId: string; simulationId: string };
    }
  | {
      name: "calculateUserPerformanceBySimulation";
      args: { profileId: string };
    }
  | { name: "calculateMessagesPerSession"; args?: object }
  | { name: "calculatePersonaResponseTimes"; args?: object }
  | { name: "calculateSessionEfficiency"; args?: object }
  | { name: "calculateStagnationRate"; args?: object }
  | { name: "calculateTimeSpent"; args?: object }
  | { name: "calculateTotalAttempts"; args?: object }
  | {
      name: "calculateScenarioAttributeBreakdown";
      args: { selectedParameterId: string };
    }
  | {
      name: "calculateScenarioPerformance";
      args: { selectedParameterId: string };
    }
  | {
      name: "calculateSimulationComposition";
      args?: {
        method?: "percentile" | "quartile" | "standard_deviation";
        topPercentage?: number;
        bottomPercentage?: number;
      };
    }
  | {
      name: "calculateScenarioPerformanceWithinSimulation";
      args: {
        selectedSimulationId: string;
        thresholds?: { danger: number; warning: number; success: number };
      };
    }
  | { name: "calculateSimulationPerformance"; args?: object }
  | {
      name: "calculateAttemptImprovement";
      args?: { selectedSimulationIds?: string[] };
    }
  | { name: "calculatePlatformGrowth"; args?: object }
  | {
      name: "calculatePersonaPerformance";
      args?: { selectedSimulationIds?: string[] };
    }
  | {
      name: "calculateCohortPerformance";
      args?: {
        thresholds?: { danger: number; warning: number; success: number };
        selectedSimulationIds?: string[];
      };
    }
  | {
      name: "calculateSkillPerformance";
      args?: { selectedRubricIds?: string[] };
    }
  | { name: "calculateRubricHeatmap"; args?: { selectedRubricIds?: string[] } };

// Result typing by name (broad, JSON-safe)
export type DashboardResultMap = Record<string, unknown>;

export async function getAnalyticsDashboard(
  filters: AnalyticsFilters,
  functions: DashboardFunctionArgs[]
) {
  return api<{ results: DashboardResultMap }>("/api/analytics/dashboard", {
    method: "POST",
    body: JSON.stringify({ filters, functions }),
  });
}
