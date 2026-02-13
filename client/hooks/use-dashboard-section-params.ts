/**
 * Client-side hook for dashboard section picker URL state management.
 * Each chart picker's selected IDs and search terms are synced to the URL
 * via nuqs useQueryStates with shallow: false so changes trigger server re-render.
 */

"use client";

import { createParser, parseAsString, useQueryStates } from "nuqs";
import { useCallback } from "react";

/**
 * Custom parser for comma-separated arrays (client-side).
 * Maintains URL format: `?personaSimulationIds=id1,id2`
 */
const parseAsCommaSeparatedArray = createParser({
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

const dashboardSectionParamsClient = {
  // Primary: PersonaPerformance
  personaSimulationIds: parseAsCommaSeparatedArray,
  personaSimulationsSearch: parseAsString,
  // Primary: RubricHeatmap
  heatmapRubricIds: parseAsCommaSeparatedArray,
  heatmapRubricSearch: parseAsString,
  // Secondary: CohortPerformance
  cohortSimulationIds: parseAsCommaSeparatedArray,
  cohortSimulationsSearch: parseAsString,
  // Secondary: AttemptImprovement
  improvementSimulationIds: parseAsCommaSeparatedArray,
  improvementSimulationsSearch: parseAsString,
  // Secondary: SkillPerformance
  skillRubricIds: parseAsCommaSeparatedArray,
  skillRubricSearch: parseAsString,
  // Footer: ScenarioPerformance
  scenarioPerfParameterIds: parseAsCommaSeparatedArray,
  scenarioPerfParamSearch: parseAsString,
  // Footer: ScenarioStats
  scenarioStatsParameterIds: parseAsCommaSeparatedArray,
  scenarioStatsParamSearch: parseAsString,
  // Footer: SimulationPerformance
  simPerfSimulationIds: parseAsCommaSeparatedArray,
  simPerfSimulationSearch: parseAsString,
} as const;

export function useDashboardSectionParams() {
  const [params, setParams] = useQueryStates(dashboardSectionParamsClient, {
    shallow: false,
    history: "replace",
  });

  // Primary: PersonaPerformance
  const setPersonaSimulationIds = useCallback(
    (ids: string[]) => {
      setParams({ personaSimulationIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setPersonaSimulationsSearch = useCallback(
    (term: string) => {
      setParams({ personaSimulationsSearch: term || null });
    },
    [setParams],
  );

  // Primary: RubricHeatmap
  const setHeatmapRubricIds = useCallback(
    (ids: string[]) => {
      setParams({ heatmapRubricIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setHeatmapRubricSearch = useCallback(
    (term: string) => {
      setParams({ heatmapRubricSearch: term || null });
    },
    [setParams],
  );

  // Secondary: CohortPerformance
  const setCohortSimulationIds = useCallback(
    (ids: string[]) => {
      setParams({ cohortSimulationIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setCohortSimulationsSearch = useCallback(
    (term: string) => {
      setParams({ cohortSimulationsSearch: term || null });
    },
    [setParams],
  );

  // Secondary: AttemptImprovement
  const setImprovementSimulationIds = useCallback(
    (ids: string[]) => {
      setParams({ improvementSimulationIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setImprovementSimulationsSearch = useCallback(
    (term: string) => {
      setParams({ improvementSimulationsSearch: term || null });
    },
    [setParams],
  );

  // Secondary: SkillPerformance
  const setSkillRubricIds = useCallback(
    (ids: string[]) => {
      setParams({ skillRubricIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setSkillRubricSearch = useCallback(
    (term: string) => {
      setParams({ skillRubricSearch: term || null });
    },
    [setParams],
  );

  // Footer: ScenarioPerformance
  const setScenarioPerfParameterIds = useCallback(
    (ids: string[]) => {
      setParams({ scenarioPerfParameterIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setScenarioPerfParamSearch = useCallback(
    (term: string) => {
      setParams({ scenarioPerfParamSearch: term || null });
    },
    [setParams],
  );

  // Footer: ScenarioStats
  const setScenarioStatsParameterIds = useCallback(
    (ids: string[]) => {
      setParams({ scenarioStatsParameterIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setScenarioStatsParamSearch = useCallback(
    (term: string) => {
      setParams({ scenarioStatsParamSearch: term || null });
    },
    [setParams],
  );

  // Footer: SimulationPerformance
  const setSimPerfSimulationIds = useCallback(
    (ids: string[]) => {
      setParams({ simPerfSimulationIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setSimPerfSimulationSearch = useCallback(
    (term: string) => {
      setParams({ simPerfSimulationSearch: term || null });
    },
    [setParams],
  );

  return {
    params,
    // Primary: PersonaPerformance
    setPersonaSimulationIds,
    setPersonaSimulationsSearch,
    // Primary: RubricHeatmap
    setHeatmapRubricIds,
    setHeatmapRubricSearch,
    // Secondary: CohortPerformance
    setCohortSimulationIds,
    setCohortSimulationsSearch,
    // Secondary: AttemptImprovement
    setImprovementSimulationIds,
    setImprovementSimulationsSearch,
    // Secondary: SkillPerformance
    setSkillRubricIds,
    setSkillRubricSearch,
    // Footer: ScenarioPerformance
    setScenarioPerfParameterIds,
    setScenarioPerfParamSearch,
    // Footer: ScenarioStats
    setScenarioStatsParameterIds,
    setScenarioStatsParamSearch,
    // Footer: SimulationPerformance
    setSimPerfSimulationIds,
    setSimPerfSimulationSearch,
  };
}
