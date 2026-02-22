/**
 * Server-side search params schema for analytics pages.
 * Uses nuqs/server for type-safe URL search param parsing.
 * This file should only be imported by server components.
 */

import {
  createLoader,
  createParser,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

/**
 * Custom parser for comma-separated arrays.
 * Maintains current URL format: `?cohortIds=id1,id2`
 */
export const parseAsCommaSeparatedArray = createParser({
  parse: (value: string) => {
    if (!value) return null;
    const arr = value.split(",").filter(Boolean);
    return arr.length > 0 ? arr : null;
  },
  serialize: (value: string[]) => {
    if (!value || value.length === 0) return "";
    return value.join(",");
  },
});

/**
 * Base analytics search params shared across all analytics pages.
 * Matches the current URL format used by analytics-context.tsx.
 */
export const analyticsSearchParams = {
  startDate: parseAsString,
  endDate: parseAsString,
  cohortIds: parseAsCommaSeparatedArray,
  departmentIds: parseAsCommaSeparatedArray,
  roles: parseAsCommaSeparatedArray,
  simulationFilters: parseAsCommaSeparatedArray,
};

/**
 * History search params shared across pages with simulation history tables.
 */
export const historySearchParams = {
  historyPage: parseAsInteger,
  historyPageSize: parseAsInteger,
  historySearch: parseAsString,
  historyProfileIds: parseAsCommaSeparatedArray,
  historySimulationIds: parseAsCommaSeparatedArray,
  historyScenarioIds: parseAsCommaSeparatedArray,
  historyInfiniteMode: parseAsBoolean,
  historySortBy: parseAsString,
  historySortOrder: parseAsString,
  historyProfileSearch: parseAsString,
  historySimulationSearch: parseAsString,
  historyScenarioSearch: parseAsString,
};

/**
 * Dashboard section picker search params for server-driven chart filtering.
 * Each chart's picker state is synced to URL params so sections refetch with filtered data.
 */
export const dashboardSectionSearchParams = {
  // Primary: RubricHeatmap + RubricTrend + SkillPerformance (all rubric pickers)
  heatmapRubricIds: parseAsCommaSeparatedArray,
  heatmapRubricSearch: parseAsString,
  trendRubricIds: parseAsCommaSeparatedArray,
  trendRubricSearch: parseAsString,
  skillRubricIds: parseAsCommaSeparatedArray,
  skillRubricSearch: parseAsString,
  // Secondary: PersonaPerformance + CohortPerformance + AttemptImprovement (all simulation pickers)
  personaSimulationIds: parseAsCommaSeparatedArray,
  personaSimulationsSearch: parseAsString,
  cohortSimulationIds: parseAsCommaSeparatedArray,
  cohortSimulationsSearch: parseAsString,
  improvementSimulationIds: parseAsCommaSeparatedArray,
  improvementSimulationsSearch: parseAsString,
  // Footer: scenario perf + scenario stats + scenario sim perf + scenario comp
  scenarioPerfParameterIds: parseAsCommaSeparatedArray,
  scenarioPerfParamSearch: parseAsString,
  scenarioStatsParameterIds: parseAsCommaSeparatedArray,
  scenarioStatsParamSearch: parseAsString,
  scenarioSimPerfScenarioIds: parseAsCommaSeparatedArray,
  scenarioSimPerfScenarioSearch: parseAsString,
  scenarioCompScenarioIds: parseAsCommaSeparatedArray,
  scenarioCompScenarioSearch: parseAsString,
};

export const loadAnalyticsSearchParams = createLoader(analyticsSearchParams);
export const loadHistorySearchParams = createLoader(historySearchParams);
export const loadDashboardSectionSearchParams = createLoader(dashboardSectionSearchParams);
