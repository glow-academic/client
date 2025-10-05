import type { TAPerformanceData } from "@/hooks/use-report-columns";
import type { DataPoint, Method, MetricResponse } from "@/lib/analytics";
import { computeCurrent } from "@/lib/analytics";

// A minimal shape we'll fold into TAPerformanceData
type PartialRow = {
  id: string; // profileId
  averageScore?: number;
  completionPercentage?: number;
  firstAttemptPassRate?: number;
  highestScore?: number;
  messagesPerSession?: number;
  personaResponseTimes?: number;
  sessionEfficiency?: number;
  stagnationRate?: number;
  timeSpent?: number;
  totalAttempts?: number;
};

type MetricKey =
  | "averageScore"
  | "completionPercentage"
  | "firstAttemptPassRate"
  | "highestScore"
  | "messagesPerSession"
  | "personaResponseTimes"
  | "sessionEfficiency"
  | "stagnationRate"
  | "timeSpent"
  | "totalAttempts";

function computePerProfile(
  method: Method,
  dataPoints: DataPoint[],
  keyField?: string
) {
  // group points by profileId, then computeCurrent(method, pointsForProfile)
  const map = new Map<string, number>();
  const byProfile = new Map<string, DataPoint[]>();

  for (const p of dataPoints ?? []) {
    const id = p.profileId;
    if (!id) continue;
    if (!byProfile.has(id)) byProfile.set(id, []);
    byProfile.get(id)!.push(p);
  }

  for (const [id, pts] of byProfile) {
    map.set(
      id,
      computeCurrent(
        method,
        pts,
        "value",
        keyField as
          | "attemptId"
          | "simulationId"
          | "profileId"
          | "date"
          | undefined
      )
    );
  }
  return map; // profileId -> metric value
}

// merge each metric map into a single profile → row object
export function buildRowsFromMetrics(
  metrics: Record<MetricKey, MetricResponse | undefined>
): Map<string, PartialRow> {
  const rows = new Map<string, PartialRow>();

  const attach = (key: MetricKey, resp?: MetricResponse) => {
    if (!resp?.dataPoints?.length) return;
    const map = computePerProfile(resp.method, resp.dataPoints, resp.keyField);
    for (const [id, val] of map) {
      const row = rows.get(id) ?? { id };
      (row as Record<string, unknown>)[key] = Number.isFinite(val)
        ? Math.round(val)
        : 0;
      rows.set(id, row);
    }
  };

  attach("averageScore", metrics.averageScore);
  attach("completionPercentage", metrics.completionPercentage);
  attach("firstAttemptPassRate", metrics.firstAttemptPassRate);
  attach("highestScore", metrics.highestScore);
  attach("messagesPerSession", metrics.messagesPerSession);
  attach("personaResponseTimes", metrics.personaResponseTimes);
  attach("sessionEfficiency", metrics.sessionEfficiency);
  attach("stagnationRate", metrics.stagnationRate);
  attach("timeSpent", metrics.timeSpent);
  attach("totalAttempts", metrics.totalAttempts);

  return rows;
}

// Expand PartialRow → TAPerformanceData with defaults.
// Names are hydrated by caller (via useProfile), so we leave placeholders here.
export function finalizeRow(
  base: PartialRow,
  profile: { firstName?: string; lastName?: string; username?: string } | null
): TAPerformanceData {
  const firstName = profile?.firstName ?? "";
  const lastName = profile?.lastName ?? "";
  const username = profile?.username ?? base.id;

  const totalSessions = base.totalAttempts ?? 0;
  const completedSessions = Math.round(
    ((base.completionPercentage ?? 0) / 100) * totalSessions
  );

  return {
    id: base.id,
    firstName,
    lastName,
    username,

    averageScore: base.averageScore ?? 0,
    completionPercentage: base.completionPercentage ?? 0,
    firstAttemptPassRate: base.firstAttemptPassRate ?? 0,
    highestScore: base.highestScore ?? 0,
    messagesPerSession: base.messagesPerSession ?? 0,
    personaResponseTimes: base.personaResponseTimes ?? 0,
    sessionEfficiency: base.sessionEfficiency ?? 0,
    stagnationRate: base.stagnationRate ?? 0,
    timeSpent: base.timeSpent ?? 0,
    totalAttempts: base.totalAttempts ?? 0,

    // risk toy values (keep your original logic if you had it)
    riskLevel: "good",
    riskDetails: { goodCount: 0, warningCount: 0, dangerCount: 0 },

    // legacy/compat
    avgScore: base.averageScore ?? 0,
    completedSessions,
    totalSessions,
    completionRate: base.completionPercentage ?? 0,
    initials: `${(firstName[0] ?? "").toUpperCase()}${(lastName[0] ?? "").toUpperCase()}`,
    skillBreakdown: [],
    weakestSkill: { skill: "", score: 0, feedbackCount: 0 },
    strongestSkill: { skill: "", score: 0, feedbackCount: 0 },
    avgTimeMinutes: base.timeSpent ?? 0,
    passRate: base.completionPercentage ?? 0,
    trend: "stable",
    isStruggling:
      (base.totalAttempts ?? 0) === 0 ||
      ((base.averageScore ?? 0) < 70 && (base.totalAttempts ?? 0) > 0),
    hasNoSessions: (base.totalAttempts ?? 0) === 0,
    lastActivity: null,
    scenariosCompleted: 0,
    taCohorts: [],
    activeCohorts: 0,
    cohortComparison: [],
    bestCohortRank: 0,
    avgVsCohort: 0,
    role: "",
    personasTested: [],
    scenarioIds: [],
    simulationIds: [],
    simulationMetrics: {},
    hover: undefined,
  };
}
