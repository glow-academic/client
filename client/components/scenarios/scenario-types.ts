/**
 * Type definitions for Scenario component
 * Extracted from Scenario.tsx for better organization
 */

import type { GetScenarioOut } from "@/app/(main)/training/scenarios/s/[scenarioId]/page";

/**
 * Draft state type for scenario form
 * Form fields are stored in draftState (not URL-backed)
 * NOTE: This is kept for backward compatibility during migration.
 * New form state should use resource IDs only (see ScenarioFormState below).
 */
/**
 * @deprecated This type is kept for backward compatibility during migration.
 * New code should use ScenarioFormState which stores only resource IDs.
 */
export type DraftState = {
  name: string;
  problemStatement: string;
  objectives: string[];
  departmentIds: string[];
  personaIds: string[];
  documentIds: string[];
  templateDocumentIds: string[];
  parameterIds: string[];
  fieldIds: string[];
  imageIds: string[];
  objectiveIds: string[];
  problemStatementIds: string[];
  useImage: boolean;
  useVideo: boolean;
  useObjectives: boolean;
  useQuestions: boolean;
  useProblemStatement: boolean;
  videoLength: number | null;
  active: boolean;
  randomize: string | null;
  randomizePersonas: string | null;
  randomizeDocuments: string | null;
  randomizeParameters: string | null;
  // Legacy fields removed - use resource-based approach instead
  // fieldShowSelected: Record<string, boolean>;
  // fieldRanges: Record<string, { min: number; max: number }>;
  // randomizeParameterItems: Record<string, string>;
  // personaMin: number | null;
  // personaMax: number | null;
  // documentMin: number | null;
  // documentMax: number | null;
  // parameterSelectionMin: number | null;
  // parameterSelectionMax: number | null;
};

/**
 * Form state type for scenario form (resource-based architecture)
 * Stores only resource IDs - display values are managed inside resource components
 */
export type ScenarioFormState = {
  // Single-select resources
  name_id: string | null;
  description_id: string | null;
  problem_statement_id: string | null;
  // Single-select flags
  active_flag_id: string | null;
  objectives_enabled_flag_id: string | null;
  images_enabled_flag_id: string | null;
  video_enabled_flag_id: string | null;
  questions_enabled_flag_id: string | null;
  problem_statement_enabled_flag_id: string | null;
  // Multi-select resources
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  template_document_ids: string[];
  parameter_ids: string[];
  field_ids: string[];
  image_ids: string[];
  objective_ids: string[];
  // Other fields (not resources)
  video_length: number | null;
};

/**
 * Staged selections per department (preserved when departments are deselected)
 */
export type StagedSelections = {
  persona_ids?: string[];
  document_ids?: string[];
  field_ids?: string[];
};

/**
 * Image mapping item type
 */
export type ImageMappingItem = {
  id: string;
  name: string;
  upload_id?: string;
  file_path?: string;
  mime_type?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Video mapping item type
 */
export type VideoMappingItem = {
  id: string;
  name: string;
  length_seconds: number;
  upload_id?: string;
};

/**
 * Type guard to check if data is ScenarioDetailOut (unified GetScenarioOut with scenario_exists = true)
 * Properly narrows GetScenarioOut to ensure scenario_id exists
 */
export function isScenarioDetailOut(data: unknown): data is GetScenarioOut {
  if (
    typeof data === "object" &&
    data !== null &&
    "scenario_exists" in data &&
    "scenario_id" in data
  ) {
    const typed = data as GetScenarioOut;
    return typed.scenario_exists === true && typed.scenario_id !== null;
  }
  return false;
}

/**
 * Type guard to check if data is ScenarioNewOut (unified GetScenarioOut with scenario_exists = false)
 * Properly narrows GetScenarioOut to ensure scenario_id is null
 */
export function isScenarioNewOut(data: unknown): data is GetScenarioOut {
  if (typeof data === "object" && data !== null && "scenario_exists" in data) {
    const typed = data as GetScenarioOut;
    return typed.scenario_exists === false;
  }
  return false;
}
