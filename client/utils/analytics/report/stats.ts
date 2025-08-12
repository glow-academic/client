import { FilteredViewForTa } from "./filtering";

// Helper: percent from raw score using simulation rubric points
function toPercent(scorePoints: number, rubricPoints: number): number {
  if (!rubricPoints || rubricPoints <= 0) return 0;
  return Math.round((scorePoints / rubricPoints) * 100);
}

// Average Score: compute mean/median/mode of rubric-normalized grade percents
export function computeAverageScoreStats(view: FilteredViewForTa): {
  mean: number;
  median: number;
  mode: number;
} {
  const percents: number[] = [];
  for (const g of view.grades) {
    const chat = view.chats.find((c) => c.id === g.simulationChatId);
    if (!chat) continue;
    // Find simulation via attempt → simulationId
    const attempt = view.attempts.find((a) => a.id === chat.attemptId);
    if (!attempt) continue;
    const rubricPoints =
      view.rubricPointsBySimulationId.get(attempt.simulationId) || 100;
    percents.push(toPercent(g.score, rubricPoints));
  }
  if (percents.length === 0) return { mean: 0, median: 0, mode: 0 };

  const mean = Math.round(
    percents.reduce((s, v) => s + v, 0) / percents.length
  );

  const sorted = [...percents].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  let median: number;
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? sorted[mid] ?? 0;
    const right = sorted[mid] ?? left;
    median = Math.round((left + right) / 2);
  } else {
    median = sorted[mid] ?? 0;
  }

  const freq = new Map<number, number>();
  for (const v of percents) freq.set(v, (freq.get(v) || 0) + 1);
  let modeValue: number = percents.length > 0 ? percents[0]! : mean;
  let best = -1;
  for (const [val, count] of freq.entries()) {
    if (count > best || (count === best && val > modeValue)) {
      best = count;
      modeValue = val;
    }
  }
  return { mean, median, mode: modeValue };
}

// Highest Score: top N rubric-normalized scores
export function computeTopScores(
  view: FilteredViewForTa,
  topN: number = 3
): number[] {
  const percents: number[] = [];
  for (const g of view.grades) {
    const chat = view.chats.find((c) => c.id === g.simulationChatId);
    if (!chat) continue;
    const attempt = view.attempts.find((a) => a.id === chat.attemptId);
    if (!attempt) continue;
    const rubricPoints =
      view.rubricPointsBySimulationId.get(attempt.simulationId) || 100;
    percents.push(toPercent(g.score, rubricPoints));
  }
  return percents.sort((a, b) => b - a).slice(0, topN);
}

// Time Spent: compute average session time (grade.timeTaken),
// average chat time (from chat timestamps when available), and average time spent (same as session)
export function computeTimeStats(view: FilteredViewForTa): {
  avgSessionMinutes: number;
  avgChatMinutes: number;
  avgOverallMinutes: number;
} {
  // Session time based on grades.timeTaken (seconds)
  const sessionSeconds = view.grades.map((g) => g.timeTaken).filter(Boolean);
  const avgSessionMinutes =
    sessionSeconds.length > 0
      ? Math.round(
          sessionSeconds.reduce((s, v) => s + v, 0) / sessionSeconds.length / 60
        )
      : 0;

  // Chat time based on chat createdAt -> completedAt/updatedAt
  const chatDurationsSec: number[] = [];
  for (const c of view.chats) {
    const start = new Date(c.createdAt).getTime();
    const endRaw = c.completedAt ?? c.updatedAt;
    const end = endRaw ? new Date(endRaw).getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const delta = Math.max(0, Math.round((end - start) / 1000));
    chatDurationsSec.push(delta);
  }
  const avgChatMinutes =
    chatDurationsSec.length > 0
      ? Math.round(
          chatDurationsSec.reduce((s, v) => s + v, 0) /
            chatDurationsSec.length /
            60
        )
      : 0;

  const avgOverallMinutes = avgSessionMinutes; // synonym for clarity

  return { avgSessionMinutes, avgChatMinutes, avgOverallMinutes };
}

// Messages per session: show mean messages per chat, median messages per chat, and chats counted
export function computeMessageStats(view: FilteredViewForTa): {
  mean: number;
  median: number;
  count: number;
} {
  const counts: number[] = [];
  for (const c of view.chats) {
    const msgs = view.messagesByChat.get(c.id) || [];
    counts.push(msgs.length);
  }
  if (counts.length === 0) return { mean: 0, median: 0, count: 0 };
  const mean = Math.round(counts.reduce((s, v) => s + v, 0) / counts.length);
  const sorted = [...counts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round(
          ((sorted[mid - 1] ?? sorted[mid] ?? 0) +
            (sorted[mid] ?? sorted[mid - 1] ?? 0)) /
            2
        )
      : (sorted[mid] ?? 0);
  return { mean, median, count: counts.length };
}

// Persona response times (seconds): average across all query->response deltas
export function computePersonaResponseStats(view: FilteredViewForTa): {
  meanSeconds: number;
  medianSeconds: number;
  samples: number;
} {
  const deltas: number[] = [];
  for (const c of view.chats) {
    const msgs = (view.messagesByChat.get(c.id) || []).sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (let i = 1; i < msgs.length; i++) {
      const prev = msgs[i - 1];
      const cur = msgs[i];
      if (prev?.type === "query" && cur?.type === "response") {
        const delta =
          (new Date(cur.createdAt).getTime() -
            new Date(prev.createdAt).getTime()) /
          1000;
        if (delta >= 0 && Number.isFinite(delta))
          deltas.push(Math.round(delta));
      }
    }
  }
  if (deltas.length === 0)
    return { meanSeconds: 0, medianSeconds: 0, samples: 0 };
  const meanSeconds = Math.round(
    deltas.reduce((s, v) => s + v, 0) / deltas.length
  );
  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianSeconds =
    sorted.length % 2 === 0
      ? Math.round(
          ((sorted[mid - 1] ?? sorted[mid] ?? 0) +
            (sorted[mid] ?? sorted[mid - 1] ?? 0)) /
            2
        )
      : (sorted[mid] ?? 0);
  return { meanSeconds, medianSeconds, samples: deltas.length };
}

// Session efficiency: ratio of avg score (%) to avg time (min)
export function computeSessionEfficiencyStats(view: FilteredViewForTa): {
  avgScorePercent: number;
  avgMinutes: number;
  efficiency: number;
} {
  if (view.grades.length === 0)
    return { avgScorePercent: 0, avgMinutes: 0, efficiency: 0 };
  const percents: number[] = [];
  const minutes: number[] = [];
  for (const g of view.grades) {
    const chat = view.chats.find((c) => c.id === g.simulationChatId);
    if (!chat) continue;
    const attempt = view.attempts.find((a) => a.id === chat.attemptId);
    if (!attempt) continue;
    const rubricPoints =
      view.rubricPointsBySimulationId.get(attempt.simulationId) || 100;
    percents.push(Math.round((g.score / rubricPoints) * 100));
    minutes.push((g.timeTaken || 0) / 60);
  }
  const avgScorePercent = percents.length
    ? Math.round(percents.reduce((s, v) => s + v, 0) / percents.length)
    : 0;
  const avgMinutes = minutes.length
    ? Math.round((minutes.reduce((s, v) => s + v, 0) / minutes.length) * 10) /
      10
    : 0;
  const efficiency =
    avgMinutes > 0 ? Math.round((avgScorePercent / avgMinutes) * 10) / 10 : 0;
  return { avgScorePercent, avgMinutes, efficiency };
}

// Stagnation: compare first vs last average scores in same-simulation sequences
export function computeStagnationStats(view: FilteredViewForTa): {
  tracked: number;
  stagnant: number;
  ratePercent: number;
} {
  // Group attempts by simulation
  const attemptsBySimulation = new Map<string, typeof view.attempts>();
  for (const a of view.attempts) {
    const arr = attemptsBySimulation.get(a.simulationId) ?? [];
    arr.push(a);
    attemptsBySimulation.set(a.simulationId, arr);
  }
  let tracked = 0;
  let stagnant = 0;
  for (const [, attempts] of attemptsBySimulation) {
    if (attempts.length < 3) continue;
    tracked += 1;
    const sorted = attempts.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;
    // Gather grades
    const firstChats = view.chats.filter((c) => c.attemptId === first!.id);
    const lastChats = view.chats.filter((c) => c.attemptId === last!.id);
    const firstPercents: number[] = [];
    for (const c of firstChats) {
      const g = view.grades.find((gr) => gr.simulationChatId === c.id);
      if (!g) continue;
      const rubricPoints =
        view.rubricPointsBySimulationId.get(first!.simulationId) || 100;
      firstPercents.push(Math.round((g.score / rubricPoints) * 100));
    }
    const lastPercents: number[] = [];
    for (const c of lastChats) {
      const g = view.grades.find((gr) => gr.simulationChatId === c.id);
      if (!g) continue;
      const rubricPoints =
        view.rubricPointsBySimulationId.get(last!.simulationId) || 100;
      lastPercents.push(Math.round((g.score / rubricPoints) * 100));
    }
    if (firstPercents.length === 0 || lastPercents.length === 0) continue;
    const firstAvg =
      firstPercents.reduce((s, v) => s + v, 0) / firstPercents.length;
    const lastAvg =
      lastPercents.reduce((s, v) => s + v, 0) / lastPercents.length;
    const improvement =
      firstAvg === 0 ? 0 : ((lastAvg - firstAvg) / firstAvg) * 100;
    if (improvement < 5) stagnant += 1;
  }
  const ratePercent =
    tracked === 0 ? 0 : Math.round((stagnant / tracked) * 100);
  return { tracked, stagnant, ratePercent };
}

// Total attempts simple rollup
export function computeAttemptsStats(view: FilteredViewForTa): {
  attempts: number;
  uniqueSimulations: number;
  perSimulationMean: number;
} {
  const attempts = view.attempts.length;
  const simSet = new Set(view.attempts.map((a) => a.simulationId));
  const uniqueSimulations = simSet.size;
  const perSimulationMean =
    uniqueSimulations > 0
      ? Math.round((attempts / uniqueSimulations) * 10) / 10
      : 0;
  return { attempts, uniqueSimulations, perSimulationMean };
}

// Completion: completed chats vs total chats, and percent
export function computeCompletionStats(view: FilteredViewForTa): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = view.chats.length;
  const completed = view.chats.filter((c) => !!c.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

// First attempt pass: for each attempt, use the first chat's grade to determine pass
export function computeFirstAttemptPassStats(view: FilteredViewForTa): {
  passed: number;
  total: number;
  percent: number;
} {
  let total = 0;
  let passed = 0;
  for (const attempt of view.attempts) {
    // Chats for this attempt, sorted by createdAt
    const chatsForAttempt = view.chats
      .filter((c) => c.attemptId === attempt.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    if (chatsForAttempt.length === 0) continue;
    const firstChat = chatsForAttempt[0];
    if (!firstChat) continue;
    const grade = view.grades.find((g) => g.simulationChatId === firstChat.id);
    if (!grade) continue;
    total += 1;
    if (grade.passed) passed += 1;
  }
  const percent = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { passed, total, percent };
}
