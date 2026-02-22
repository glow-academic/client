/**
 * Client-side hook for dashboard section picker URL state management.
 * Each section's selected IDs, search term, and carousel index are synced to the URL
 * via nuqs useQueryStates with shallow: false so changes trigger server re-render.
 */

"use client";

import { createParser, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback } from "react";

/**
 * Custom parser for comma-separated arrays (client-side).
 * Maintains URL format: `?rubricIds=id1,id2`
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
  // Rubric section: Heatmap + Trend + SkillPerformance
  rubricIds: parseAsCommaSeparatedArray,
  rubricSearch: parseAsString,
  rubricIndex: parseAsInteger,
  // Simulation section: Persona + Cohort + AttemptImprovement
  simulationPickerIds: parseAsCommaSeparatedArray,
  simulationPickerSearch: parseAsString,
  simulationIndex: parseAsInteger,
  // Parameter section: ScenarioPerformance + ScenarioStats
  parameterIds: parseAsCommaSeparatedArray,
  parameterSearch: parseAsString,
  parameterIndex: parseAsInteger,
  // Scenario section: ScenarioSimPerf + ScenarioComposition
  scenarioIds: parseAsCommaSeparatedArray,
  scenarioSearch: parseAsString,
  scenarioIndex: parseAsInteger,
} as const;

export function useDashboardSectionParams() {
  const [params, setParams] = useQueryStates(dashboardSectionParamsClient, {
    shallow: false,
    history: "replace",
  });

  // Rubric section
  const setRubricIds = useCallback(
    (ids: string[]) => {
      setParams({ rubricIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setRubricSearch = useCallback(
    (term: string) => {
      setParams({ rubricSearch: term || null });
    },
    [setParams],
  );
  const setRubricIndex = useCallback(
    (index: number) => {
      setParams({ rubricIndex: index === 0 ? null : index });
    },
    [setParams],
  );

  // Simulation section
  const setSimulationPickerIds = useCallback(
    (ids: string[]) => {
      setParams({ simulationPickerIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setSimulationPickerSearch = useCallback(
    (term: string) => {
      setParams({ simulationPickerSearch: term || null });
    },
    [setParams],
  );
  const setSimulationIndex = useCallback(
    (index: number) => {
      setParams({ simulationIndex: index === 0 ? null : index });
    },
    [setParams],
  );

  // Parameter section
  const setParameterIds = useCallback(
    (ids: string[]) => {
      setParams({ parameterIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setParameterSearch = useCallback(
    (term: string) => {
      setParams({ parameterSearch: term || null });
    },
    [setParams],
  );
  const setParameterIndex = useCallback(
    (index: number) => {
      setParams({ parameterIndex: index === 0 ? null : index });
    },
    [setParams],
  );

  // Scenario section
  const setScenarioIds = useCallback(
    (ids: string[]) => {
      setParams({ scenarioIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );
  const setScenarioSearch = useCallback(
    (term: string) => {
      setParams({ scenarioSearch: term || null });
    },
    [setParams],
  );
  const setScenarioIndex = useCallback(
    (index: number) => {
      setParams({ scenarioIndex: index === 0 ? null : index });
    },
    [setParams],
  );

  return {
    params,
    // Rubric section
    setRubricIds,
    setRubricSearch,
    setRubricIndex,
    // Simulation section
    setSimulationPickerIds,
    setSimulationPickerSearch,
    setSimulationIndex,
    // Parameter section
    setParameterIds,
    setParameterSearch,
    setParameterIndex,
    // Scenario section
    setScenarioIds,
    setScenarioSearch,
    setScenarioIndex,
  };
}
