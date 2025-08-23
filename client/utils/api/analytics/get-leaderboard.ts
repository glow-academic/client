/**
 * get-leaderboard.ts
 * Used to get leaderboard.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/logger";

export interface GetLeaderboardParams {
  startDate: string;
  endDate: string;
  cohortIds: string[];
  roles: string[];
  simulationFilters: string[];
  profileId?: string;
}

export interface LeaderboardRow {
  profile_id: string;
  first_name: string;
  last_name: string;
  total_attempts: number;
  highest_score_avg: number;
  messages_per_session: number;
  time_spent_minutes: number;
  quickest_pass_minutes: number;
  most_improved_percent?: number;
  improvement_rate_per_day?: number;
  perfect_score_count?: number;
}

export async function getLeaderboard(
  params: GetLeaderboardParams
): Promise<LeaderboardRow[]> {
  try {
    const url = new URL(`${getApiBase()}/analytics/leaderboard`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to get analytics: ${response.status} ${response.statusText}`;
      log.error("analytics.get.leaderboard.failed", {
        message: errorMessage,
        context: { function: "getLeaderboard", params },
      });
      throw new Error(errorMessage);
    }

    const result = (await response.json()) as LeaderboardRow[];
    return result;
  } catch (error) {
    const errorMessage = `Error getting analytics: ${error instanceof Error ? error.message : "Unknown error"}`;
    log.error("analytics.get.leaderboard.error", {
      message: errorMessage,
      error,
      context: { function: "getLeaderboard", params },
    });
    throw new Error(errorMessage);
  }
}