/**
 * Helper functions for Scenario component
 * Extracted from Scenario.tsx for better organization
 */

import type {
  ScenarioDetailOut,
  ScenarioNewOut,
} from "@/app/(main)/create/scenarios/s/[scenarioId]/page";
import { stringifyJsonDict } from "@/app/(main)/create/scenarios/searchParams";
import type { DraftState } from "./scenario-types";

/**
 * Build search params URL including filters, search terms, ranges, and feature flags
 * This function builds the base URL state (filters, searches, ranges) for server-side filtering
 */
export function buildSearchParams({
  draftState,
  selectedPersonaIds,
  currentDocumentIds,
  templateDocumentIds,
  currentFieldIds,
  currentProblemStatementIds,
  currentObjectiveIds,
  personaSearchTerm,
  documentSearchTerm,
  parameterSearchTerm,
  documentShowSelected,
  documentShowTemplate,
  personaShowSelected,
  parameterShowSelected,
  fieldShowSelectedByParam,
  personaMinMax,
  documentMinMax,
  parameterSelectionMinMax,
  fieldMinMax,
  useObjectives,
  useImage,
  useVideo,
  useQuestions,
  useProblemStatement,
  queryParamConfig,
  searchParams,
  problemStatement,
  currentObjectives,
  name,
  isEditMode,
  scenarioData,
}: {
  draftState: DraftState;
  selectedPersonaIds: string[];
  currentDocumentIds: string[];
  templateDocumentIds: string[];
  currentFieldIds: string[];
  currentProblemStatementIds: string[];
  currentObjectiveIds: string[];
  personaSearchTerm: string;
  documentSearchTerm: string;
  parameterSearchTerm: string;
  documentShowSelected: boolean;
  documentShowTemplate: boolean;
  personaShowSelected: boolean;
  parameterShowSelected: boolean;
  fieldShowSelectedByParam: Record<string, boolean>;
  personaMinMax: { min: number; max: number };
  documentMinMax: { min: number; max: number };
  parameterSelectionMinMax: { min: number; max: number };
  fieldMinMax: Record<string, { min: number; max: number }>;
  useObjectives: boolean;
  useImage: boolean;
  useVideo: boolean;
  useQuestions: boolean;
  useProblemStatement: boolean;
  queryParamConfig: {
    defaults: {
      objectives_enabled: boolean;
      images_enabled: boolean;
      video_enabled: boolean;
      questions_enabled: boolean;
    };
    getServerValue: (
      field:
        | "objectives_enabled"
        | "images_enabled"
        | "video_enabled"
        | "questions_enabled"
    ) => boolean;
    urlParamNames: {
      objectives_enabled: string;
      images_enabled: string;
      video_enabled: string;
      questions_enabled: string;
    };
  };
  searchParams: URLSearchParams;
  problemStatement: string;
  currentObjectives: string[];
  name: string;
  isEditMode: boolean;
  scenarioData: ScenarioNewOut | ScenarioDetailOut | undefined;
}): URLSearchParams {
  const params = new URLSearchParams();

  // Add filter params (always include if non-empty)
  // Arrays are handled by nuqs automatically, but we still need to set them for URLSearchParams
  // Note: This function is used for manual URL building, nuqs handles arrays automatically
  if (draftState.departmentIds && draftState.departmentIds.length > 0) {
    // nuqs will handle array serialization
    draftState.departmentIds.forEach((id) => {
      params.append("departmentIds", id);
    });
  }
  if (selectedPersonaIds.length > 0) {
    selectedPersonaIds.forEach((id) => {
      params.append("personaIds", id);
    });
  }
  if (currentDocumentIds.length > 0) {
    currentDocumentIds.forEach((id) => {
      params.append("documentIds", id);
    });
  }
  if (templateDocumentIds.length > 0) {
    templateDocumentIds.forEach((id) => {
      params.append("templateDocumentIds", id);
    });
  }
  if (draftState.parameterIds && draftState.parameterIds.length > 0) {
    draftState.parameterIds.forEach((id) => {
      params.append("parameterIds", id);
    });
  }
  if (currentFieldIds.length > 0) {
    currentFieldIds.forEach((id) => {
      params.append("fieldIds", id);
    });
  }
  if (currentProblemStatementIds.length > 0) {
    currentProblemStatementIds.forEach((id) => {
      params.append("problemStatementIds", id);
    });
  }
  if (currentObjectiveIds.length > 0) {
    currentObjectiveIds.forEach((id) => {
      params.append("objectiveIds", id);
    });
  }

  // Add search params when non-empty
  if (personaSearchTerm.trim()) {
    params.set("personaSearch", personaSearchTerm);
  }
  if (documentSearchTerm.trim()) {
    params.set("documentSearch", documentSearchTerm);
  }
  if (parameterSearchTerm.trim()) {
    params.set("parameterSearch", parameterSearchTerm);
  }

  // Add filter params when true (omit when false, following boolean flag pattern)
  if (documentShowSelected) {
    params.set("documentShowSelected", "true");
  }
  if (documentShowTemplate) {
    params.set("documentShowTemplate", "true");
  }
  if (personaShowSelected) {
    params.set("personaShowSelected", "true");
  }
  if (parameterShowSelected) {
    params.set("parameterShowSelected", "true");
  }
  // Add per-parameter field filters (JSON-encoded dict)
  const fieldShowSelectedJson = stringifyJsonDict(fieldShowSelectedByParam);
  if (fieldShowSelectedJson) {
    params.set("fieldShowSelected", fieldShowSelectedJson);
  }
  // Add range params when different from server-provided current values
  // Compare against server's current values (persona_min/persona_max), not allowed_ranges
  const serverCurrentValues = scenarioData as ScenarioNewOut | undefined;

  // Persona ranges - compare against server's current values
  const serverPersonaMin = serverCurrentValues?.persona_min ?? 1;
  const serverPersonaMax = serverCurrentValues?.persona_max ?? 1;
  if (
    personaMinMax.min !== serverPersonaMin ||
    personaMinMax.max !== serverPersonaMax
  ) {
    params.set("personaMin", personaMinMax.min.toString());
    params.set("personaMax", personaMinMax.max.toString());
  }

  // Document ranges - compare against server's current values
  const serverDocumentMin = serverCurrentValues?.document_min ?? 0;
  const serverDocumentMax = serverCurrentValues?.document_max ?? 1;
  if (
    documentMinMax.min !== serverDocumentMin ||
    documentMinMax.max !== serverDocumentMax
  ) {
    params.set("documentMin", documentMinMax.min.toString());
    params.set("documentMax", documentMinMax.max.toString());
  }

  // Parameter selection ranges - compare against server's current values
  const serverParameterMin = serverCurrentValues?.parameter_selection_min ?? 0;
  const serverParameterMax = serverCurrentValues?.parameter_selection_max ?? 3;
  if (
    parameterSelectionMinMax.min !== serverParameterMin ||
    parameterSelectionMinMax.max !== serverParameterMax
  ) {
    params.set(
      "parameterSelectionMin",
      parameterSelectionMinMax.min.toString()
    );
    params.set(
      "parameterSelectionMax",
      parameterSelectionMinMax.max.toString()
    );
  }

  // Per-parameter field ranges - compare against server's current values
  // Include ranges for selected parameters, or for all parameters if randomize=all (server needs ranges for randomized params)
  const selectedParamIds = draftState.parameterIds || [];
  const isRandomizing = searchParams.get("randomize") === "all";
  const serverFieldRanges = serverCurrentValues?.field_ranges || {};

  // Build filtered ranges dict (only include ranges that differ from server or are needed for randomization)
  const filteredFieldRanges: Record<string, { min: number; max: number }> = {};
  Object.entries(fieldMinMax).forEach(([paramId, range]) => {
    // Include range if:
    // 1. Parameter is selected, OR
    // 2. We're randomizing all (server will randomize parameters and need these ranges)
    // AND range differs from server's current value
    const shouldInclude = isRandomizing || selectedParamIds.includes(paramId);
    const serverFieldRange = serverFieldRanges[paramId] as
      | { min?: number; max?: number }
      | undefined;
    const fieldDefaultMin = serverFieldRange?.["min"] ?? 1;
    const fieldDefaultMax = serverFieldRange?.["max"] ?? 3;
    const fieldDefault: { min: number; max: number } = {
      min: fieldDefaultMin,
      max: fieldDefaultMax,
    };
    if (
      shouldInclude &&
      (range["min"] !== fieldDefault.min || range["max"] !== fieldDefault.max)
    ) {
      filteredFieldRanges[paramId] = range;
    }
  });

  // Add field ranges as JSON-encoded dict
  const fieldRangesJson = stringifyJsonDict(filteredFieldRanges);
  if (fieldRangesJson) {
    params.set("fieldRanges", fieldRangesJson);
  }

  // Feature flags - compare against server's current values (edit mode) or defaults (create mode)
  // Objectives flag - always include when true to preserve user intent, only include false if it differs from default
  if (useObjectives) {
    params.set(queryParamConfig.urlParamNames.objectives_enabled, "true");
  } else {
    // Only include false if it differs from the default (for edit mode when server value was true)
    const serverObjectivesEnabled =
      queryParamConfig.getServerValue("objectives_enabled");
    if (useObjectives !== serverObjectivesEnabled) {
      params.set(queryParamConfig.urlParamNames.objectives_enabled, "false");
    }
  }

  const serverImageEnabled = queryParamConfig.getServerValue("images_enabled");
  if (useImage !== serverImageEnabled) {
    params.set(
      queryParamConfig.urlParamNames.images_enabled,
      useImage ? "true" : "false"
    );
  }

  const serverVideoEnabled = queryParamConfig.getServerValue("video_enabled");
  if (useVideo !== serverVideoEnabled) {
    params.set(
      queryParamConfig.urlParamNames.video_enabled,
      useVideo ? "true" : "false"
    );
  }

  const serverQuestionsEnabled =
    queryParamConfig.getServerValue("questions_enabled");
  if (useQuestions !== serverQuestionsEnabled) {
    params.set(
      queryParamConfig.urlParamNames.questions_enabled,
      useQuestions ? "true" : "false"
    );
  }

  // Problem statement flag - no server-side enabled flag, so only include when true
  if (useProblemStatement) {
    params.set("useProblemStatement", "true");
  }

  // Add text fields when they differ from server values
  // Problem statement text (now managed by nuqs)
  const serverProblemStatement =
    isEditMode && scenarioData && "problem_statement" in scenarioData
      ? (scenarioData as ScenarioDetailOut).problem_statement || ""
      : "";
  if (
    problemStatement &&
    problemStatement.trim() !== "" &&
    problemStatement.trim() !== serverProblemStatement
  ) {
    params.set("problemStatement", problemStatement);
  }

  // Objectives text (JSON-encoded array, now managed by nuqs)
  // Include all objectives (even empty strings) to preserve the count of enabled objective slots
  const serverObjectives =
    isEditMode && scenarioData && "objectives_history" in scenarioData
      ? (scenarioData as ScenarioDetailOut).objectives_history?.map(
          (obj) => obj.objective
        ) || []
      : [];
  const currentObjectivesString = JSON.stringify(currentObjectives);
  const serverObjectivesString = JSON.stringify(serverObjectives);
  // Always include objectives if they differ from server (even if empty strings - preserves count)
  if (currentObjectivesString !== serverObjectivesString) {
    params.set("objectives", currentObjectivesString);
  }

  // Name text (now managed by nuqs)
  const serverName =
    isEditMode && scenarioData && "name" in scenarioData
      ? (scenarioData as ScenarioDetailOut).name || ""
      : "New Scenario";
  if (
    name &&
    name.trim() !== "" &&
    name !== "New Scenario" &&
    name !== serverName
  ) {
    params.set("name", name);
  }

  // Note: randomize param is set separately by randomize handlers, not here
  // This function builds the base URL state (filters, searches, ranges)

  return params;
}
