"use client";

import type {
  AnalyticsFilters,
  DataPoint,
  Method,
  MetricResponse,
} from "@/lib/analytics";
import { computeCurrent } from "@/lib/analytics";
import {
  useAnalyticsHighestScore,
  useAnalyticsImprovementPerDay,
  useAnalyticsMessagesPerSession, // leaderboard
  useAnalyticsPerfectScores,
  useAnalyticsPersonaResponseTimes, // leaderboard
  useAnalyticsQuickestPass,
  useAnalyticsTimeSpent,
  useAnalyticsTotalAttempts,
} from "@/lib/api/hooks/analytics";

// shape consumed by your LeaderboardTable + accolades
export type LeaderboardRowLite = {
  profileId: string;
  firstName: string | undefined;
  lastName: string | undefined;

  // header-derived (5)
  highestScoreAvg: number; // we'll use "current best" as proxy; rename keeps your table props
  messagesPerSession: number;
  personaResponseSeconds: number;
  timeSpentMinutes: number;
  totalAttempts: number;

  // leaderboard-derived (3)
  improvementRatePerDay: number; // pts/day
  perfectScoreCount: number;
  quickestPassMinutes: number;

  // optional extras if you need them later
  mostImprovedPercent: number | undefined;
};

type MetricKeyHeader =
  | "highestScoreAvg"
  | "messagesPerSession"
  | "personaResponseSeconds"
  | "timeSpentMinutes"
  | "totalAttempts";

type MetricKeyBoard =
  | "improvementRatePerDay"
  | "perfectScoreCount"
  | "quickestPassMinutes";

function groupAndCompute(method: Method, points: DataPoint[]) {
  // points: [{ profileId, date, value, ... }]
  const byProfile = new Map<string, DataPoint[]>();
  for (const p of points ?? []) {
    const id = p.profileId;
    if (!id) continue;
    if (!byProfile.has(id)) byProfile.set(id, []);
    byProfile.get(id)!.push(p);
  }
  const out = new Map<string, number>();
  for (const [id, list] of byProfile) {
    out.set(id, computeCurrent(method, list));
  }
  return out; // profileId -> value
}

export function useLeaderboardData(filters: AnalyticsFilters) {
  // Use the individual hooks directly instead of trying to access queryFn
  const highestScore = useAnalyticsHighestScore(filters);
  const messagesPerSession = useAnalyticsMessagesPerSession(filters);
  const personaResponseTimes = useAnalyticsPersonaResponseTimes(filters);
  const timeSpent = useAnalyticsTimeSpent(filters);
  const totalAttempts = useAnalyticsTotalAttempts(filters);
  const improvementPerDay = useAnalyticsImprovementPerDay(filters);
  const perfectScores = useAnalyticsPerfectScores(filters);
  const quickestPass = useAnalyticsQuickestPass(filters);

  const isLoading = [
    highestScore,
    messagesPerSession,
    personaResponseTimes,
    timeSpent,
    totalAttempts,
    improvementPerDay,
    perfectScores,
    quickestPass,
  ].some((q) => q.isLoading);

  const isError = [
    highestScore,
    messagesPerSession,
    personaResponseTimes,
    timeSpent,
    totalAttempts,
    improvementPerDay,
    perfectScores,
    quickestPass,
  ].some((q) => q.isError);

  // Header maps
  const highestResp = highestScore.data;
  const msgsResp = messagesPerSession.data;
  const respTimeResp = personaResponseTimes.data;
  const timeSpentResp = timeSpent.data;
  const attemptsResp = totalAttempts.data;

  // Leaderboard maps
  const improveResp = improvementPerDay.data;
  const perfectResp = perfectScores.data;
  const quickestResp = quickestPass.data;

  // Build per-profile rows
  const rowsMap = new Map<string, LeaderboardRowLite>();

  const plugHeader = (
    key: MetricKeyHeader,
    resp?: MetricResponse,
    transform?: (n: number) => number
  ) => {
    if (!resp?.dataPoints?.length) return;
    const map = groupAndCompute(resp.method, resp.dataPoints);
    for (const [id, raw] of map) {
      const val = Number.isFinite(raw) ? raw : 0;
      const r = rowsMap.get(id) ?? {
        profileId: id,
        firstName: undefined,
        lastName: undefined,
        highestScoreAvg: 0,
        messagesPerSession: 0,
        personaResponseSeconds: 0,
        timeSpentMinutes: 0,
        totalAttempts: 0,
        improvementRatePerDay: 0,
        perfectScoreCount: 0,
        quickestPassMinutes: 0,
        mostImprovedPercent: undefined,
      };
      (r as Record<string, unknown>)[key] = Math.round(
        transform ? transform(val) : val
      );
      rowsMap.set(id, r);
    }
  };

  // Header metrics → rows
  // highestScore: backend method = 'max' → treat as current best (your table label stays "avg" to match existing prop)
  plugHeader("highestScoreAvg", highestResp);
  plugHeader("messagesPerSession", msgsResp);
  plugHeader("personaResponseSeconds", respTimeResp);
  plugHeader("timeSpentMinutes", timeSpentResp);
  plugHeader("totalAttempts", attemptsResp);

  const plugBoard = (key: MetricKeyBoard, resp?: MetricResponse) => {
    if (!resp?.dataPoints?.length) return;
    const map = groupAndCompute(resp.method, resp.dataPoints);
    for (const [id, raw] of map) {
      const r = rowsMap.get(id) ?? {
        profileId: id,
        firstName: undefined,
        lastName: undefined,
        highestScoreAvg: 0,
        messagesPerSession: 0,
        personaResponseSeconds: 0,
        timeSpentMinutes: 0,
        totalAttempts: 0,
        improvementRatePerDay: 0,
        perfectScoreCount: 0,
        quickestPassMinutes: 0,
        mostImprovedPercent: undefined,
      };
      (r as Record<string, unknown>)[key] = Math.round(
        Number.isFinite(raw) ? raw : 0
      );
      rowsMap.set(id, r);
    }
  };

  // Leaderboard metrics → rows
  plugBoard("improvementRatePerDay", improveResp);
  plugBoard("perfectScoreCount", perfectResp);
  plugBoard("quickestPassMinutes", quickestResp);

  // Final rows (names can be hydrated outside with useProfile or a batched hook)
  const rows = Array.from(rowsMap.values());

  return { rows, isLoading, isError };
}
