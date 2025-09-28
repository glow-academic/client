import {
  AttemptImprovementData,
  AttemptImprovementFact,
  CohortDailyFact,
  CohortData,
  CohortFact,
  DailyData,
  NumericAttemptFact,
  ScenarioAttributeAttemptFact,
  ScenarioAttributeScenarioFact,
  ScenarioFact,
  SimulationCompositionConfig,
  SimulationFact,
  SimulationParamFact,
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

// Footer Analytics Aggregators

// Scenario Performance (Categorical Parameters) Aggregators
export function buildScenarioAttributeElements(
  attemptFacts: ScenarioAttributeAttemptFact[],
  scenarioFacts: ScenarioAttributeScenarioFact[],
  parameterItemsMeta: Record<
    string,
    { name: string; icon?: string; color?: string }
  >,
  parameterId: string
) {
  const byItem = new Map<
    string,
    {
      name: string;
      icon: string;
      color: string;
      attempts: number;
      passed: number;
      scoreSum: number;
      scoreCount: number;
      dates: Map<string, { sum: number; n: number }>;
      scenarios: Set<string>;
    }
  >();

  const pushItem = (itemId: string) => {
    if (!byItem.has(itemId)) {
      const meta = parameterItemsMeta[itemId] ?? {
        name: "Unknown",
        icon: "🏷️",
        color: "#888",
      };
      byItem.set(itemId, {
        name: meta.name,
        icon: meta.icon ?? "🏷️",
        color: meta.color ?? "#888",
        attempts: 0,
        passed: 0,
        scoreSum: 0,
        scoreCount: 0,
        dates: new Map(),
        scenarios: new Set(),
      });
    }
    return byItem.get(itemId)!;
  };

  for (const f of attemptFacts) {
    if (f.parameterId !== parameterId) continue;
    const bucket = pushItem(f.parameterItemId);
    bucket.attempts += f.attempts;
    bucket.passed += f.passedAttempts;
    bucket.scoreSum += f.avgScore * Math.max(1, f.attempts);
    bucket.scoreCount += Math.max(1, f.attempts);
    const d = bucket.dates.get(f.date) ?? { sum: 0, n: 0 };
    d.sum += f.avgScore;
    d.n += 1;
    bucket.dates.set(f.date, d);
  }
  for (const s of scenarioFacts) {
    if (s.parameterId !== parameterId) continue;
    const bucket = pushItem(s.parameterItemId);
    bucket.scenarios.add(s.scenarioId);
  }

  const totalScenarios =
    [...byItem.values()].reduce((acc, b) => acc + b.scenarios.size, 0) || 1;

  return [...byItem.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([itemId, b]) => {
      const trend = [...b.dates.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({
          date,
          score: Math.round(v.sum / Math.max(1, v.n)),
          timestamp: Math.floor(new Date(`${date}/2000`).getTime() / 1000), // harmless ordering anchor
        }));
      const avgScore = b.scoreCount ? Math.round(b.scoreSum / b.scoreCount) : 0;
      const completionRate = b.attempts
        ? Math.round((100 * b.passed) / b.attempts)
        : 0;
      const count = b.scenarios.size;
      const percentage = Math.round((1000 * count) / totalScenarios) / 10;

      // simple, readable insight stub (customize as needed)
      const early = trend.slice(0, Math.min(3, trend.length));
      const late = trend.slice(-3);
      const mean = (xs: typeof trend) =>
        xs.length
          ? Math.round(xs.reduce((s, x) => s + x.score, 0) / xs.length)
          : 0;
      const delta = mean(late) - mean(early);
      const insight =
        trend.length >= 2
          ? delta >= 5
            ? `Performance has improved by ${delta}% recently.`
            : delta <= -5
              ? `Performance dipped by ${Math.abs(delta)}% recently.`
              : `Performance is steady over time.`
          : `Not enough trend data yet.`;

      return {
        id: `param-item-${itemId}`,
        name: b.name,
        displayName: b.name,
        icon: b.icon,
        color: b.color,
        count,
        percentage,
        avgScore,
        completionRate,
        totalAttempts: b.attempts,
        trendData: trend,
        insight,
      };
    });
}

// Scenario Stats (Numerical Parameters) Aggregators
export function buildScenarioNumericBars(
  facts: NumericAttemptFact[],
  parameterId: string
) {
  const rows = facts.filter((f) => f.parameterId === parameterId);
  return rows
    .sort((a, b) => {
      const ai = Number(a.level);
      const bi = Number(b.level);
      if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
      return a.level.localeCompare(b.level);
    })
    .map((r) => ({
      metricLevel: r.level,
      avgScore: r.score,
      scenarioCount: 0, // fill if you ship a scenario coverage fact
      totalAttempts: r.attempts,
      rubricPoints: 0,
    }));
}

// Simulation Composition Aggregators
export function buildSimulationComposition(
  simFacts: SimulationFact[],
  paramFacts: SimulationParamFact[],
  config: SimulationCompositionConfig
) {
  if (!simFacts.length)
    return {
      highPerforming: [],
      lowPerforming: [],
      highPerformingCount: 0,
      lowPerformingCount: 0,
      highPerformingDetails: [],
      lowPerformingDetails: [],
    };

  // split sims
  const scores = simFacts.map((s) => s.avgScore).sort((a, b) => a - b);
  const pct = (p: number) =>
    scores[
      Math.min(
        scores.length - 1,
        Math.max(0, Math.floor((p / 100) * (scores.length - 1)))
      )
    ];
  const hiSet = new Set<string>(),
    loSet = new Set<string>();
  if (config.method === "percentile") {
    const hiCut = pct(100 - config.topPercentage),
      loCut = pct(config.bottomPercentage);
    for (const s of simFacts) {
      if (hiCut !== undefined && s.avgScore >= hiCut) hiSet.add(s.simulationId);
      if (loCut !== undefined && s.avgScore <= loCut) loSet.add(s.simulationId);
    }
  } else if (config.method === "quartile") {
    const q1 = pct(25),
      q3 = pct(75);
    for (const s of simFacts) {
      if (q3 !== undefined && s.avgScore >= q3) hiSet.add(s.simulationId);
      if (q1 !== undefined && s.avgScore <= q1) loSet.add(s.simulationId);
    }
  } else {
    const mean = simFacts.reduce((s, x) => s + x.avgScore, 0) / simFacts.length;
    const sd = Math.sqrt(
      simFacts.reduce((s, x) => s + (x.avgScore - mean) ** 2, 0) /
        Math.max(1, simFacts.length - 1)
    );
    for (const s of simFacts) {
      if (s.avgScore >= mean + sd) hiSet.add(s.simulationId);
      if (s.avgScore <= mean - sd) loSet.add(s.simulationId);
    }
  }

  const agg = (set: Set<string>) => {
    const pf = paramFacts.filter((p) => set.has(p.simulationId));
    const counts = new Map<
      string,
      { name: string; value: number; isNum: boolean }
    >();
    for (const p of pf) {
      const key = `${p.parameterName}:${p.parameterValue}:${p.isNumerical ? "num" : "cat"}`;
      const cur = counts.get(key) ?? {
        name: `${p.parameterName}: ${p.parameterValue}`,
        value: 0,
        isNum: p.isNumerical,
      };
      cur.value += p.count;
      counts.set(key, cur);
    }
    const rows = [...counts.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((r) => ({
        name: r.name,
        value: r.value,
        icon: r.isNum ? "📊" : "🏷️",
        color: r.isNum ? "#3b82f6" : "#10b981",
        description: r.name,
        significance:
          r.value >= 5
            ? "high"
            : r.value >= 3
              ? "medium"
              : r.value >= 2
                ? "low"
                : "none",
      }));
    const details = simFacts
      .filter((s) => set.has(s.simulationId))
      .map((s) => ({
        id: s.simulationId,
        title: s.title,
        avgScore: s.avgScore,
        completionRate: s.completionRate,
        totalAttempts: s.totalAttempts,
        scenarioCount: s.scenarioCount,
        parameterBreakdown: paramFacts
          .filter((p) => p.simulationId === s.simulationId)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map((p) => ({
            parameterName: p.parameterName,
            parameterValue: p.parameterValue,
            isNumerical: p.isNumerical,
          })),
      }));
    return { rows, details, count: set.size };
  };

  const hi = agg(hiSet),
    lo = agg(loSet);
  return {
    highPerforming: hi.rows,
    lowPerforming: lo.rows,
    highPerformingCount: hi.count,
    lowPerformingCount: lo.count,
    highPerformingDetails: hi.details,
    lowPerformingDetails: lo.details,
  };
}

// Simulation Performance Aggregators
export function buildSimulationScenarioBars(
  facts: ScenarioFact[],
  simulationId: string,
  thresholds: { danger: number; warning: number; success: number }
) {
  const rows = facts
    .filter((f) => f.simulationId === simulationId)
    .sort((a, b) => b.avgScore - a.avgScore)
    .map((f) => {
      const c =
        f.avgScore >= thresholds.success
          ? "#22c55e"
          : f.avgScore >= thresholds.warning
            ? "#eab308"
            : "#ef4444";
      return {
        scenarioId: f.scenarioId,
        scenarioName: f.scenarioName,
        avgScore: f.avgScore,
        successRate: f.successRate,
        performanceChange: 0, // compute from daily facts if you later add them
        totalAttempts: f.totalAttempts,
        completedAttempts: f.completedAttempts,
        color: c,
      };
    });
  // simple insight:
  const top = rows[0];
  const avg = rows.length
    ? Math.round(rows.reduce((s, x) => s + x.avgScore, 0) / rows.length)
    : 0;
  const insights = !rows.length
    ? "No scenario data available for analysis."
    : `${top?.scenarioName ?? "—"} leads at ${top?.avgScore ?? 0}%. Average is ${avg}%.`;
  return { rows, insights };
}
