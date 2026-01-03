/**
 * Type definitions for Scenario component
 * Extracted from Scenario.tsx for better organization
 */

import type {
  ScenarioDetailOut,
  ScenarioNewOut,
} from "@/app/(main)/create/scenarios/s/[scenarioId]/page";

/**
 * Draft state type for scenario form
 * Form fields are stored in draftState (not URL-backed)
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
  fieldShowSelected: Record<string, boolean>;
  fieldRanges: Record<string, { min: number; max: number }>;
  randomizeParameterItems: Record<string, string>;
  personaMin: number | null;
  personaMax: number | null;
  documentMin: number | null;
  documentMax: number | null;
  parameterSelectionMin: number | null;
  parameterSelectionMax: number | null;
  scenarioAgentId: string | null;
  imageAgentId: string | null;
  videoAgentId: string | null;
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
 * Type guard to check if data is ScenarioDetailOut
 */
export function isScenarioDetailOut(data: unknown): data is ScenarioDetailOut {
  return (
    typeof data === "object" &&
    data !== null &&
    "department_ids" in data &&
    "scenario_id" in data
  );
}

/**
 * Type guard to check if data is ScenarioNewOut
 */
export function isScenarioNewOut(data: unknown): data is ScenarioNewOut {
  return (
    typeof data === "object" &&
    data !== null &&
    "valid_department_ids" in data &&
    !("scenario_id" in data)
  );
}
