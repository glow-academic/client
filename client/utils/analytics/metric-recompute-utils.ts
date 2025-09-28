import type { DataPoint, MetricResponse } from "@/lib/analytics";

// Types aligned with your MetricResponse shape
export type MetricPoint = DataPoint;

export type RowFilter = Partial<{
  profileId: string | string[];
  simulationId: string | string[];
  scenarioId: string | string[];
  attemptId: string | string[];
}>;

function matchField(val: string | undefined, want?: string | string[]) {
  if (!want) return true;
  if (!val) return false;
  return Array.isArray(want) ? want.includes(val) : val === want;
}

export function applyRowFilter<T extends MetricPoint>(
  points: T[] | undefined,
  filter: RowFilter | undefined
): T[] {
  if (!points || !filter) return points ?? [];
  return points.filter(
    (p) =>
      matchField(p.profileId, filter.profileId) &&
      matchField(p.simulationId, filter.simulationId) &&
      matchField(p.scenarioId, filter.scenarioId) &&
      matchField(p.attemptId, filter.attemptId)
  );
}

// Small stats helpers (rounded to match your UI style)
export function mean(nums: number[]): number {
  return nums.length
    ? Math.round(nums.reduce((s, v) => s + v, 0) / nums.length)
    : 0;
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function mode(nums: number[]): number {
  if (!nums.length) return 0;
  const freq = new Map<number, number>();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);
  let best = nums[0]!,
    cBest = -1;
  for (const [v, c] of freq.entries())
    if (c > cBest || (c === cBest && v > best)) {
      best = v;
      cBest = c;
    }
  return best;
}

// Recomputers for each metric (use only the filtered dataPoints)

export function recomputeAverageScoreSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const pts = applyRowFilter(resp.dataPoints, rowFilter).filter(
    (p) => p.value != null
  ) as Required<MetricPoint>[];
  const values = pts.map((p) => Math.round(p.value!));
  return { mean: mean(values), median: median(values), mode: mode(values) };
}

export function recomputeCompletionSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const pts = applyRowFilter(resp.dataPoints, rowFilter).filter(
    (p) => p.value != null
  );
  const total = pts.length;
  const completed = pts.reduce((s, p) => s + (p.value! ? 1 : 0), 0);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

export function recomputeFirstPassSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const pts = applyRowFilter(resp.dataPoints, rowFilter).filter(
    (p) => p.value != null
  );
  const total = pts.length;
  const passed = pts.reduce((s, p) => s + (p.value! ? 1 : 0), 0);
  const percent = total ? Math.round((passed / total) * 100) : 0;
  return { passed, total, percent };
}

export function recomputeTopScores(
  resp: MetricResponse,
  rowFilter?: RowFilter,
  topN = 3
) {
  const values = applyRowFilter(resp.dataPoints, rowFilter)
    .filter((p) => p.value != null)
    .map((p) => Math.round(p.value!))
    .sort((a, b) => b - a)
    .slice(0, topN);
  return values;
}

export function recomputeMessagesSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const counts = applyRowFilter(resp.dataPoints, rowFilter)
    .filter((p) => p.value != null)
    .map((p) => Math.round(p.value!));
  return { mean: mean(counts), median: median(counts), count: counts.length };
}

export function recomputePersonaRTSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const secs = applyRowFilter(resp.dataPoints, rowFilter)
    .filter((p) => p.value != null)
    .map((p) => Math.round(p.value!));
  return {
    meanSeconds: mean(secs),
    medianSeconds: median(secs),
    samples: secs.length,
  };
}

export function recomputeEfficiencySummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const eff = applyRowFilter(resp.dataPoints, rowFilter)
    .filter((p) => p.value != null)
    .map((p) => p.value!);
  return {
    efficiency:
      Math.round((eff.reduce((s, v) => s + v, 0) / (eff.length || 1)) * 10) /
      10,
  };
}

export function recomputeStagnationSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const pts = applyRowFilter(resp.dataPoints, rowFilter).filter(
    (p) => p.value != null
  );
  const tracked = pts.length;
  const stagnant = pts.reduce((s, p) => s + (p.value! ? 1 : 0), 0);
  const ratePercent = tracked ? Math.round((stagnant / tracked) * 100) : 0;
  return { tracked, stagnant, ratePercent };
}

export function recomputeTimeSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const secs = applyRowFilter(resp.dataPoints, rowFilter)
    .filter((p) => p.value != null)
    .map((p) => p.value!);
  const avgChatMinutes = secs.length
    ? Math.round(secs.reduce((s, v) => s + v, 0) / secs.length / 60)
    : 0;
  // If you want "avg session (attempt) minutes", aggregate by attemptId using the same points:
  const byAttempt = new Map<string, number>();
  for (const p of applyRowFilter(resp.dataPoints, rowFilter)) {
    if (!p.attemptId || p.value == null) continue;
    byAttempt.set(p.attemptId, (byAttempt.get(p.attemptId) || 0) + p.value);
  }
  const attemptSecs = [...byAttempt.values()];
  const avgSessionMinutes = attemptSecs.length
    ? Math.round(
        attemptSecs.reduce((s, v) => s + v, 0) / attemptSecs.length / 60
      )
    : 0;

  return {
    avgSessionMinutes,
    avgChatMinutes,
    avgOverallMinutes: avgSessionMinutes, // keep your UI synonym
  };
}

export function recomputeAttemptsSummary(
  resp: MetricResponse,
  rowFilter?: RowFilter
) {
  const pts = applyRowFilter(resp.dataPoints, rowFilter);
  const attempts = new Set(pts.map((p) => p.attemptId).filter(Boolean)).size;
  const uniqueSims = new Set(pts.map((p) => p.simulationId).filter(Boolean))
    .size;
  const perSimulationMean = uniqueSims
    ? Math.round((attempts / uniqueSims) * 10) / 10
    : 0;
  return { attempts, uniqueSimulations: uniqueSims, perSimulationMean };
}
