import {
  AttemptImprovementData,
  AttemptImprovementFact,
  CohortDailyFact,
  CohortData,
  CohortFact,
  DailyData,
  SkillGroupFact,
  SkillRadarData,
} from "@/lib/analytics";

/**
 * Client-side aggregator utilities for fast filtering without API refetches.
 * These functions take facts arrays and selected simulation IDs to recompute
 * chart data instantly on the client side.
 */

// Attempt Improvement Aggregators

export function buildAttemptImprovementChart(
  facts: AttemptImprovementFact[],
  selectedSimulationIds?: string[]
): AttemptImprovementData[] {
  const allowed =
    selectedSimulationIds && selectedSimulationIds.length
      ? new Set(selectedSimulationIds)
      : null;

  const byAttempt = new Map<
    number,
    { g: number[]; m: number[]; p: number[] }
  >();

  for (const f of facts) {
    if (allowed && !allowed.has(f.simulationId)) continue;

    const bucket = byAttempt.get(f.attemptNo) ?? { g: [], m: [], p: [] };
    bucket.g.push(f.avgGrade);
    bucket.m.push(f.avgMinutes);
    bucket.p.push(f.passRate);
    byAttempt.set(f.attemptNo, bucket);
  }

  const attemptNos = [...byAttempt.keys()].sort((a, b) => a - b);

  return attemptNos.map((no) => {
    const b = byAttempt.get(no)!;
    const avg = (xs: number[]) =>
      Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);

    return {
      attempt: `Attempt ${no}`,
      "Average Score": avg(b.g),
      "Average Time": avg(b.m),
      "Pass Rate": avg(b.p),
    };
  });
}

// Cohort Performance Aggregators

export function buildCohortRows(
  facts: CohortFact[],
  selectedSimulationIds?: string[]
): CohortData[] {
  const allowed =
    selectedSimulationIds && selectedSimulationIds.length
      ? new Set(selectedSimulationIds)
      : null;

  const byCohort = new Map<
    string,
    {
      name: string;
      passRates: number[];
      scores: number[];
      attempts: number;
      totalStudents: number;
      passedStudents: number;
      rubricPoints: number;
      rubricPassPoints: number;
      availableSimulations: number;
    }
  >();

  for (const f of facts) {
    if (allowed && !allowed.has(f.simulationId)) continue;

    const b = byCohort.get(f.cohortId) ?? {
      name: f.cohortId, // This should be replaced with actual cohort name lookup
      passRates: [],
      scores: [],
      attempts: 0,
      totalStudents: 0,
      passedStudents: 0,
      rubricPoints: 0,
      rubricPassPoints: 0,
      availableSimulations: 0,
    };

    b.passRates.push(f.passRate);
    b.scores.push(f.avgScore);
    b.attempts += f.attempts;
    byCohort.set(f.cohortId, b);
  }

  return [...byCohort.entries()].map(([cohortId, b]) => ({
    id: cohortId,
    name: b.name,
    passRate: Math.round(
      b.passRates.reduce((s, x) => s + x, 0) / Math.max(1, b.passRates.length)
    ),
    avgPercentageScore: Math.round(
      b.scores.reduce((s, x) => s + x, 0) / Math.max(1, b.scores.length)
    ),
    totalStudents: b.totalStudents,
    passedStudents: b.passedStudents,
    totalAttempts: b.attempts,
    passedAttempts: Math.round(
      (b.attempts * b.passRates.reduce((s, x) => s + x, 0)) /
        Math.max(1, b.passRates.length) /
        100
    ),
    rubricPoints: b.rubricPoints,
    rubricPassPoints: b.rubricPassPoints,
    availableSimulations: b.availableSimulations,
    color:
      b.passRates.reduce((s, x) => s + x, 0) /
        Math.max(1, b.passRates.length) >=
      85
        ? "#10b981"
        : b.passRates.reduce((s, x) => s + x, 0) /
              Math.max(1, b.passRates.length) >=
            70
          ? "#f59e0b"
          : "#ef4444",
  }));
}

export function buildDailySeries(
  facts: CohortDailyFact[],
  selectedSimulationIds?: string[]
): DailyData[] {
  const allowed =
    selectedSimulationIds && selectedSimulationIds.length
      ? new Set(selectedSimulationIds)
      : null;

  const byDate = new Map<string, number[]>();

  for (const f of facts) {
    if (allowed && !allowed.has(f.simulationId)) continue;

    const arr = byDate.get(f.date) ?? [];
    arr.push(f.avgScore);
    byDate.set(f.date, arr);
  }

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, arr]) => ({
      date,
      avgScore: Math.round(arr.reduce((s, x) => s + x, 0) / arr.length),
    }));
}

// Skill Performance Aggregators

export function buildRadar(
  facts: SkillGroupFact[],
  selectedSimulationIds?: string[]
): SkillRadarData[] {
  const allowed =
    selectedSimulationIds && selectedSimulationIds.length
      ? new Set(selectedSimulationIds)
      : null;

  const byGroup = new Map<
    string,
    {
      name: string;
      score: number;
      points: number;
    }
  >();

  for (const f of facts) {
    if (allowed && !allowed.has(f.simulationId)) continue;

    const g = byGroup.get(f.groupId) ?? {
      name: f.groupName,
      score: 0,
      points: 0,
    };

    g.score += f.score;
    g.points += f.points;
    byGroup.set(f.groupId, g);
  }

  return [...byGroup.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({
      metric: g.name,
      value: g.points > 0 ? Math.min(1, Math.max(0, g.score / g.points)) : 0,
      fullMark: 1,
      score: g.score,
      points: g.points,
    }));
}

// Utility function to get unique simulation IDs from facts
export function getUniqueSimulationIds(
  facts: Array<{ simulationId: string }>
): string[] {
  return [...new Set(facts.map((f) => f.simulationId))];
}

// Utility function to filter facts by simulation IDs
export function filterFactsBySimulations<T extends { simulationId: string }>(
  facts: T[],
  selectedSimulationIds?: string[]
): T[] {
  if (!selectedSimulationIds || selectedSimulationIds.length === 0) {
    return facts;
  }

  const allowed = new Set(selectedSimulationIds);
  return facts.filter((f) => allowed.has(f.simulationId));
}
