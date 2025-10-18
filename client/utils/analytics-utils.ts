/**
 * Analytics Utility Functions
 * Client-side helper functions for computing analytics metrics and insights
 */

import type {
  AttemptImprovementData,
  CohortData,
  GrowthWindowAverages,
  NumericAttemptFact,
  PersonaPerformanceData,
  PersonaTrendData,
  RubricMatrixPackage,
  ScenarioAttributeAttemptFact,
  ScenarioFact,
  SimulationFact,
  SkillRadarData,
  TrendData,
} from "@/lib/api/v2/schemas/analytics";

// Narrow what can be used as "valueField" and "keyField" so indexing is safe
type ValueField = "value" | "count";
export type KeyField = "attemptId" | "simulationId" | "profileId" | "date";

// NOTE: computeCurrent() has been deprecated - use metric.currentValue from server instead
// All metrics now return currentValue computed server-side for accuracy and performance

// Utility function to compute trend analysis
export function computeTrendAnalysis(
  trendData: TrendData[],
  metricName: string
): string | null {
  if (!trendData || trendData.length < 2) return null;

  const recentData = trendData.slice(-3);
  const earlierData = trendData.slice(0, 3);

  if (!recentData.length || !earlierData.length) return null;

  const recentAvg =
    recentData.reduce((sum: number, d: TrendData) => sum + (d.value ?? 0), 0) /
    recentData.length;
  const earlierAvg =
    earlierData.reduce((sum: number, d: TrendData) => sum + (d.value ?? 0), 0) /
    earlierData.length;

  const change = recentAvg - earlierAvg;
  const changePercent =
    earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

  if (Math.abs(changePercent) < 1) return null;

  const period =
    trendData.length <= 7
      ? "3 days"
      : trendData.length <= 14
        ? "1 week"
        : "1 month";
  const direction = changePercent > 0 ? "increased" : "decreased";

  return `${metricName} ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
}

// Growth Analytics Utilities
export function computeGrowthActionableInsight(
  windowAverages: GrowthWindowAverages
): string | null {
  const current = windowAverages?.averageScore?.last;
  const previous = windowAverages?.averageScore?.prev;

  // treat 0 as valid; only null/undefined means missing
  if (current == null) return null;

  // If we have both current and previous, analyze trends
  if (previous != null) {
    // allow 0
    const improvement = current - previous;

    if (improvement < -5) {
      return `Performance declined ${Math.abs(improvement).toFixed(1)}% - review challenging areas.`;
    }

    if (improvement > 5) {
      return `Scores improved ${improvement.toFixed(1)}% - consider advanced challenges.`;
    }

    if (improvement > 2) {
      return `Steady improvement of ${improvement.toFixed(1)}% - continue current approach.`;
    }

    if (improvement < -2) {
      return `Slight decline of ${Math.abs(improvement).toFixed(1)}% - adjust study strategy.`;
    }
  }

  // Performance level-based insights
  if (current >= 90) {
    return `Outstanding performance at ${current.toFixed(1)}% - consider mentoring others.`;
  }

  if (current >= 80) {
    return `Strong performance at ${current.toFixed(1)}% - focus on consistency.`;
  }

  if (current >= 70) {
    return `Good performance at ${current.toFixed(1)}% - identify improvement areas.`;
  }

  if (current >= 60) {
    return `Average performance at ${current.toFixed(1)}% - additional practice needed.`;
  }

  if (current < 60) {
    return `Below target at ${current.toFixed(1)}% - focus on fundamentals.`;
  }

  return null;
}

// Persona Performance Analytics Utilities
export function computePersonaPerformanceStatus(
  chartData: PersonaPerformanceData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (chartData.length === 0) return "neutral";

  // Calculate average score across all personas
  const avgScore =
    chartData.reduce((sum, persona) => sum + persona.score, 0) /
    chartData.length;

  if (avgScore >= thresholds.success) return "success";
  if (avgScore >= thresholds.warning) return "warning";
  return "danger";
}

export function computePersonaActionableInsight(
  trendData: PersonaTrendData[]
): string | null {
  if (trendData.length < 2) return null;

  const recentScores = trendData.slice(-3);
  const earlierScores = trendData.slice(0, 3);

  if (recentScores.length === 0 || earlierScores.length === 0) return null;

  const recentAvg =
    recentScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    recentScores.length;
  const earlierAvg =
    earlierScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    earlierScores.length;
  const improvement = recentAvg - earlierAvg;

  if (improvement > 5) {
    return "Performance has improved significantly. Consider advancing to more challenging scenarios.";
  } else if (improvement < -5) {
    return "Performance has declined. Review training approach for this persona type.";
  }

  return null;
}

export function computePersonaMultipleActionableInsights(
  trendData: PersonaTrendData[],
  _personaName: string,
  currentScore: number
): Record<string, string | null> {
  const insights: Record<string, string | null> = {};

  if (trendData.length < 2) return insights;

  const recentScores = trendData.slice(-3);
  const earlierScores = trendData.slice(0, 3);

  if (recentScores.length === 0 || earlierScores.length === 0) return insights;

  const recentAvg =
    recentScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    recentScores.length;
  const earlierAvg =
    earlierScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    earlierScores.length;
  const improvement = recentAvg - earlierAvg;

  // Return the most impactful single insight
  if (improvement > 5) {
    insights["insight"] =
      `Performance improved ${Math.round(improvement)}% recently - consider advancing to more challenging scenarios.`;
  } else if (improvement < -5) {
    insights["insight"] =
      `Performance declined ${Math.round(Math.abs(improvement))}% recently - review training approach.`;
  } else if (currentScore >= 90) {
    insights["insight"] =
      `Excellent performance at ${Math.round(currentScore)}% - consider advanced challenges.`;
  } else if (currentScore < 60) {
    insights["insight"] =
      `Below average performance at ${Math.round(currentScore)}% - additional support needed.`;
  } else {
    insights["insight"] =
      `Steady performance at ${Math.round(currentScore)}% - focus on incremental improvements.`;
  }

  return insights;
}

// Attempt Improvement Analytics Utilities
export function computeAttemptImprovementStatus(
  chartData: AttemptImprovementData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (chartData.length < 2) return "neutral";

  const firstAttempt = chartData[0];
  const lastAttempt = chartData[chartData.length - 1];

  if (!firstAttempt || !lastAttempt) return "neutral";

  const firstScore = firstAttempt.average_score;
  const lastScore = lastAttempt.average_score;

  if (typeof firstScore !== "number" || typeof lastScore !== "number")
    return "neutral";

  const scoreImprovement = lastScore - firstScore;

  if (scoreImprovement >= thresholds.success) return "success";
  if (scoreImprovement >= thresholds.warning) return "warning";
  return "danger";
}

export function computeAttemptImprovementActionableInsight(
  chartData: AttemptImprovementData[]
): string | null {
  if (chartData.length < 2) return null;

  const firstAttempt = chartData[0];
  const lastAttempt = chartData[chartData.length - 1];

  if (!firstAttempt || !lastAttempt) return null;

  const firstScore = firstAttempt.average_score;
  const lastScore = lastAttempt.average_score;

  if (typeof firstScore !== "number" || typeof lastScore !== "number")
    return null;

  const scoreImprovement = lastScore - firstScore;

  if (scoreImprovement > 5) {
    return `Users improve by ${scoreImprovement}% on average between attempts. Consider advancing to more challenging scenarios.`;
  } else if (scoreImprovement < -5) {
    return `Performance declined by ${Math.abs(scoreImprovement)}% between attempts. Review training approach.`;
  }

  return null;
}

// Cohort Performance Analytics Utilities
export function computeCohortPerformanceStatus(
  cohortData: CohortData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (cohortData.length === 0) return "neutral";

  // Calculate average pass rate across all cohorts
  const avgPassRate =
    cohortData.reduce((sum, cohort) => sum + cohort.passRate, 0) /
    cohortData.length;

  if (avgPassRate >= thresholds.success) return "success";
  if (avgPassRate >= thresholds.warning) return "warning";
  return "danger";
}

export function computeCohortPerformanceActionableInsight(
  cohortData: CohortData[]
): string | null {
  if (cohortData.length === 0) return null;

  // Find the best performing cohort
  const bestCohort = cohortData.reduce((best, current) =>
    current.passRate > best.passRate ? current : best
  );

  if (bestCohort.passRate > 0) {
    return `Top cohort: ${bestCohort.name} • Avg pass rate ${Math.round(bestCohort.passRate)}%.`;
  }

  return null;
}

export function computeCohortMultipleActionableInsights(
  cohortData: CohortData[]
): Record<string, Record<string, string | null>> {
  const insights: Record<string, Record<string, string | null>> = {};

  if (cohortData.length === 0) return insights;

  // Sort cohorts by performance
  const sortedCohorts = [...cohortData].sort((a, b) => b.passRate - a.passRate);
  const avgPassRate =
    cohortData.reduce((sum, cohort) => sum + cohort.passRate, 0) /
    cohortData.length;

  // Check if all cohorts are high performers
  const highPerformers = cohortData.filter((c) => c.passRate >= 90);
  const allHighPerformers = highPerformers.length === cohortData.length;

  // Generate single focused insight for each cohort
  cohortData.forEach((cohort) => {
    const cohortInsights: Record<string, string | null> = {};
    const rank = sortedCohorts.findIndex((c) => c.id === cohort.id) + 1;
    const totalCohorts = cohortData.length;
    const passRateDiff = cohort.passRate - avgPassRate;

    // Return the most impactful single insight
    if (cohort.passRate >= 95) {
      if (allHighPerformers) {
        cohortInsights["insight"] =
          `Outstanding performance at ${Math.round(cohort.passRate)}% - maintain excellence and mentor others.`;
      } else {
        cohortInsights["insight"] =
          `Exceptional performance at ${Math.round(cohort.passRate)}% - share best practices with other cohorts.`;
      }
    } else if (cohort.passRate >= 90) {
      if (allHighPerformers) {
        cohortInsights["insight"] =
          `Strong performance at ${Math.round(cohort.passRate)}% - continue current strategies.`;
      } else {
        cohortInsights["insight"] =
          `Excellent performance at ${Math.round(cohort.passRate)}% - share successful approaches.`;
      }
    } else if (cohort.passRate < 60) {
      cohortInsights["insight"] =
        `Critical attention needed - ${Math.round(cohort.passRate)}% pass rate requires immediate intervention.`;
    } else if (passRateDiff > 15) {
      cohortInsights["insight"] =
        `Outperforming average by ${Math.round(passRateDiff)}% - consider leadership opportunities.`;
    } else if (passRateDiff < -15) {
      cohortInsights["insight"] =
        `Underperforming average by ${Math.round(-passRateDiff)}% - additional support needed.`;
    } else if (rank === 1) {
      cohortInsights["insight"] =
        `Top performer with ${Math.round(cohort.passRate)}% pass rate - maintain current approach.`;
    } else {
      cohortInsights["insight"] =
        `Ranked ${rank}/${totalCohorts} with ${Math.round(cohort.passRate)}% pass rate - focus on incremental improvements.`;
    }

    insights[cohort.id] = cohortInsights;
  });

  return insights;
}

// Skill Performance Analytics Utilities
export function computeSkillPerformanceStatus(
  radarData: SkillRadarData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (radarData.length === 0) return "neutral";

  // Calculate average skill performance across all skills
  const avgSkillPerformance =
    radarData.reduce((sum, skill) => sum + skill.value, 0) / radarData.length;

  if (avgSkillPerformance >= thresholds.success) return "success";
  if (avgSkillPerformance >= thresholds.warning) return "warning";
  return "danger";
}

export function computeSkillPerformanceActionableInsight(
  radarData: SkillRadarData[]
): string | null {
  if (radarData.length === 0) return null;

  // Calculate skill statistics
  const values = radarData.map((skill) => skill.value);
  const avgProficiency =
    values.reduce((sum, val) => sum + val, 0) / values.length;
  const minProficiency = Math.min(...values);
  const maxProficiency = Math.max(...values);
  const skillGap = maxProficiency - minProficiency;

  // Find skills by performance level
  const weakSkills = radarData.filter((skill) => skill.value < 0.5);
  const strongSkills = radarData.filter((skill) => skill.value >= 0.8);

  // Significant skill gaps
  if (skillGap > 0.4) {
    const weakestSkill = radarData.reduce((weakest, current) =>
      current.value < weakest.value ? current : weakest
    );
    return `Large skill gap - focus on ${weakestSkill.metric} (${Math.round(weakestSkill.value * 100)}%).`;
  }

  // Multiple weak skills
  if (weakSkills.length > 1) {
    return `Multiple weak areas - focus on fundamentals.`;
  }

  // Single weak skill
  if (weakSkills.length === 1) {
    const weakSkill = weakSkills[0];
    if (weakSkill) {
      return `Focus on ${weakSkill.metric} (${Math.round(weakSkill.value * 100)}%).`;
    }
  }

  // All skills are strong
  if (strongSkills.length === radarData.length) {
    return `All skills strong (${Math.round(avgProficiency * 100)}%) - consider advanced challenges.`;
  }

  // Low overall performance
  if (avgProficiency < 0.6) {
    return `Overall development needed (${Math.round(avgProficiency * 100)}%) - focus on fundamentals.`;
  }

  return null;
}

/**
 * Compute actionable insights for rubric heatmap data
 */
export function computeRubricHeatmapActionableInsight(
  matrices: RubricMatrixPackage[]
): string | null {
  if (matrices.length === 0) return null;

  // Use the first matrix for insight calculation
  const matrix = matrices[0];
  if (!matrix || !matrix.hasData) return null;

  // Find the strongest positive and negative correlations
  let strongestPositive = { correlation: 0, pair: "" };
  let strongestNegative = { correlation: 0, pair: "" };

  for (let i = 0; i < matrix.matrix.length; i++) {
    for (let j = 0; j < matrix.matrix[i]!.length; j++) {
      if (i !== j) {
        const cell = matrix.matrix[i]![j];
        if (cell && cell.dataPoints > 0) {
          const correlation = cell.correlation;
          const rowGroup = matrix.standardGroups?.[i];
          const colGroup = matrix.standardGroups?.[j];

          if (rowGroup && colGroup) {
            const pair = `${rowGroup.shortName} ↔ ${colGroup.shortName}`;

            if (correlation > strongestPositive.correlation) {
              strongestPositive = { correlation, pair };
            }
            if (correlation < strongestNegative.correlation) {
              strongestNegative = { correlation, pair };
            }
          }
        }
      }
    }
  }

  // Generate insights based on correlation patterns
  if (strongestPositive.correlation > 0.7) {
    return `Strong positive correlation (${strongestPositive.correlation.toFixed(2)}) between ${strongestPositive.pair}. These skills develop together.`;
  } else if (strongestNegative.correlation < -0.7) {
    return `Strong negative correlation (${strongestNegative.correlation.toFixed(2)}) between ${strongestNegative.pair}. These skills may compete for attention.`;
  } else if (strongestPositive.correlation > 0.5) {
    return `Moderate positive correlation (${strongestPositive.correlation.toFixed(2)}) between ${strongestPositive.pair}. Consider integrated learning approaches.`;
  }

  return null;
}

/**
 * Compute actionable insights for scenario performance data
 */
export function computeScenarioPerformanceActionableInsight(
  attributeAttemptFacts: ScenarioAttributeAttemptFact[]
): string | null {
  if (attributeAttemptFacts.length === 0) return null;

  // Find the parameter item with the highest average score
  const byParameterItem = new Map<
    string,
    { totalScore: number; totalAttempts: number }
  >();

  for (const fact of attributeAttemptFacts) {
    const key = fact.parameterItemId;
    const current = byParameterItem.get(key) || {
      totalScore: 0,
      totalAttempts: 0,
    };
    current.totalScore += fact.avgScore * fact.attempts;
    current.totalAttempts += fact.attempts;
    byParameterItem.set(key, current);
  }

  let bestItem = { id: "", score: 0 };
  for (const [id, data] of byParameterItem.entries()) {
    const avgScore =
      data.totalAttempts > 0 ? data.totalScore / data.totalAttempts : 0;
    if (avgScore > bestItem.score) {
      bestItem = { id, score: avgScore };
    }
  }

  if (bestItem.score > 0) {
    return `Top performing attribute achieves ${Math.round(bestItem.score)}% average score. Consider expanding similar scenarios.`;
  }

  return null;
}

/**
 * Compute actionable insights for scenario stats data
 */
export function computeScenarioStatsActionableInsight(
  numericAttemptFacts: NumericAttemptFact[]
): string | null {
  if (numericAttemptFacts.length === 0) return null;

  // Calculate correlation between level value and score
  let totalCorrelation = 0;
  let correlationCount = 0;

  // Group by parameter to calculate correlation for each
  const byParameter = new Map<string, NumericAttemptFact[]>();
  for (const fact of numericAttemptFacts) {
    const existing = byParameter.get(fact.parameterId) || [];
    existing.push(fact);
    byParameter.set(fact.parameterId, existing);
  }

  for (const facts of byParameter.values()) {
    if (facts.length < 2) continue;

    // Simple correlation calculation
    const n = facts.length;
    const sumX = facts.reduce((s, f) => s + f.levelValue, 0);
    const sumY = facts.reduce((s, f) => s + f.score, 0);
    const sumXY = facts.reduce((s, f) => s + f.levelValue * f.score, 0);
    const sumXX = facts.reduce((s, f) => s + f.levelValue * f.levelValue, 0);
    const sumYY = facts.reduce((s, f) => s + f.score * f.score, 0);

    const correlation =
      (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    if (!isNaN(correlation)) {
      totalCorrelation += Math.abs(correlation);
      correlationCount++;
    }
  }

  if (correlationCount > 0) {
    const avgCorrelation = totalCorrelation / correlationCount;
    if (avgCorrelation > 0.7) {
      return `Strong correlation (${avgCorrelation.toFixed(2)}) between parameter levels and performance. Consider adjusting difficulty curves.`;
    } else if (avgCorrelation > 0.5) {
      return `Moderate correlation (${avgCorrelation.toFixed(2)}) between parameter levels and performance. Review level progression.`;
    }
  }

  return null;
}

/**
 * Compute actionable insights for simulation performance data
 */
export function computeSimulationPerformanceActionableInsight(
  scenarioFacts: ScenarioFact[]
): string | null {
  if (scenarioFacts.length === 0) return null;

  // Find the best and worst performing scenarios
  const sortedByScore = scenarioFacts.sort((a, b) => b.avgScore - a.avgScore);
  const best = sortedByScore[0];
  const worst = sortedByScore[sortedByScore.length - 1];

  if (best && worst && best.avgScore > worst.avgScore) {
    const scoreDiff = best.avgScore - worst.avgScore;
    if (scoreDiff > 20) {
      return `Performance gap of ${Math.round(scoreDiff)}% between best (${best.scenarioName}) and worst (${worst.scenarioName}) scenarios. Consider rebalancing difficulty.`;
    }
  }

  // Check for low success rates
  const lowSuccess = scenarioFacts.filter((s) => s.successRate < 50);
  if (lowSuccess.length > 0) {
    return `${lowSuccess.length} scenario(s) have success rates below 50%. Review these scenarios for potential improvements.`;
  }

  return null;
}

// Simulation Composition Utility Functions
export function computeSimulationCompositionActionableInsight(
  simulationFacts: SimulationFact[]
): string | null {
  if (!simulationFacts || simulationFacts.length === 0) {
    return null;
  }

  // Calculate performance statistics
  const avgScore =
    simulationFacts.reduce((sum, sim) => sum + sim.avgScore, 0) /
    simulationFacts.length;
  const avgCompletion =
    simulationFacts.reduce((sum, sim) => sum + sim.completionRate, 0) /
    simulationFacts.length;

  // Find top and bottom performers
  const sortedByScore = [...simulationFacts].sort(
    (a, b) => b.avgScore - a.avgScore
  );
  const topPerformer = sortedByScore[0];
  const bottomPerformer = sortedByScore[sortedByScore.length - 1];

  // Performance gap analysis
  if (topPerformer && bottomPerformer) {
    const performanceGap = topPerformer.avgScore - bottomPerformer.avgScore;

    if (performanceGap > 30) {
      return `Significant performance gap (${performanceGap.toFixed(0)}%) between top performer "${topPerformer.title}" (${topPerformer.avgScore}%) and bottom performer "${bottomPerformer.title}" (${bottomPerformer.avgScore}%). Consider analyzing composition differences.`;
    }
  }

  if (avgScore < 60) {
    return `Overall performance is below 60% (${avgScore.toFixed(0)}%). Focus on improving simulation composition and scenario design.`;
  }

  if (avgCompletion < 70) {
    return `Completion rate is low (${avgCompletion.toFixed(0)}%). Consider adjusting simulation difficulty or providing better guidance.`;
  }

  if (avgScore >= 80 && avgCompletion >= 80) {
    return `Strong performance across simulations (${avgScore.toFixed(0)}% avg score, ${avgCompletion.toFixed(0)}% completion). Current composition appears effective.`;
  }

  return `Moderate performance (${avgScore.toFixed(0)}% avg score, ${avgCompletion.toFixed(0)}% completion). Consider analyzing top performers for optimization opportunities.`;
}
