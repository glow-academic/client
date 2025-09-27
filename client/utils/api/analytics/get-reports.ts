"use server";
import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/logger";

export interface GetReportsParams {
  startDate: string;
  endDate: string;
  cohortIds: string[];
  roles: string[];
  simulationFilters: string[];
  profileId?: string;
}

export interface ReportRow {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  averageScore: number;
  completionPercentage: number;
  firstAttemptPassRate: number;
  highestScore: number;
  messagesPerSession: number;
  personaResponseTimes: number;
  sessionEfficiency: number;
  stagnationRate: number;
  timeSpent: number;
  totalAttempts: number;
  riskLevel: "good" | "warning" | "danger";
  riskDetails: { dangerCount: number; warningCount: number; goodCount: number };
  completedSessions: number;
  totalSessions: number;
  lastActivity: number | null;
  scenariosCompleted: number;
  personasTested: string[];
  scenarioIds: string[];
  simulationIds: string[];
  simulationMetrics: Record<
    string,
    {
      averageScore: number;
      highestScore: number;
      completionPercentage: number;
      firstAttemptPassRate: number;
      timeSpent: number;
      messagesPerSession: number;
      sessionEfficiency: number;
      totalAttempts: number;
    }
  >;
  hover?: {
    scoreStats?: { mean: number; median: number; mode: number; top?: number[] };
    timeStats?: {
      avgSessionMinutes: number;
      avgChatMinutes: number;
      avgOverallMinutes: number;
    };
    messageStats?: { mean: number; median: number; count: number };
    completionStats?: { completed: number; total: number; percent: number };
    firstAttemptStats?: { passed: number; total: number; percent: number };
    personaResponseStats?: {
      meanSeconds: number;
      medianSeconds: number;
      samples: number;
    };
    efficiencyStats?: {
      avgScorePercent: number;
      avgMinutes: number;
      efficiency: number;
    };
    stagnationStats?: {
      tracked: number;
      stagnant: number;
      ratePercent: number;
    };
  };
}

export interface ReportsResponse {
  rows: ReportRow[];
  cohortSimulationIds: string[];
}

export async function getReports(
  params: GetReportsParams
): Promise<ReportsResponse> {
  try {
    const url = new URL(`${getApiBase()}/analytics/reports`);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to get reports: ${response.status} ${response.statusText}`;
      log.error("analytics.get.reports.failed", {
        message: errorMessage,
        context: { function: "getReports", params },
      });
      throw new Error(errorMessage);
    }
    return (await response.json()) as ReportsResponse;
  } catch (error) {
    const errorMessage = `Error getting reports: ${error instanceof Error ? error.message : "Unknown error"}`;
    log.error("analytics.get.reports.error", {
      message: errorMessage,
      error,
      context: { function: "getReports", params },
    });
    throw new Error(errorMessage);
  }
}
