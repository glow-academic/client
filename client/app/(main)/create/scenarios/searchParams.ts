/**
 * Shared search params schema for scenario pages
 * Uses nuqs for type-safe URL search param parsing
 */

import {
  parseAsArrayOf,
  parseAsBoolean as parseAsBooleanClient,
  parseAsInteger as parseAsIntegerClient,
  parseAsString as parseAsStringClient,
} from "nuqs";
import {
  createLoader,
  parseAsArrayOf as parseAsArrayOfServer,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

// Shared parsers for both create and edit modes
export const scenarioSearchParams = {
  // ID arrays (using nuqs array parsing)
  departmentIds: parseAsArrayOfServer(parseAsString),
  personaIds: parseAsArrayOfServer(parseAsString),
  documentIds: parseAsArrayOfServer(parseAsString),
  templateDocumentIds: parseAsArrayOfServer(parseAsString),
  parameterIds: parseAsArrayOfServer(parseAsString),
  fieldIds: parseAsArrayOfServer(parseAsString),

  // Generated resources IDs
  imageIds: parseAsArrayOfServer(parseAsString),
  objectiveIds: parseAsArrayOfServer(parseAsString),
  problemStatementIds: parseAsArrayOfServer(parseAsString),

  // Search terms
  personaSearch: parseAsString,
  documentSearch: parseAsString,
  parameterSearch: parseAsString,

  // Filter toggles
  documentShowSelected: parseAsBoolean,
  documentShowTemplate: parseAsBoolean,
  personaShowSelected: parseAsBoolean,
  parameterShowSelected: parseAsBoolean,

  // Range values
  personaMin: parseAsInteger,
  personaMax: parseAsInteger,
  documentMin: parseAsInteger,
  documentMax: parseAsInteger,
  parameterSelectionMin: parseAsInteger,
  parameterSelectionMax: parseAsInteger,

  // Feature flags
  useImage: parseAsBoolean,
  useVideo: parseAsBoolean,
  useObjectives: parseAsBoolean,
  useQuestions: parseAsBoolean,
  useProblemStatement: parseAsBoolean,

  // Text fields
  name: parseAsString,
  problemStatement: parseAsString,
  objectives: parseAsString, // JSON-encoded array: string[]
  videoLength: parseAsInteger, // 4, 8, or 12

  // Create mode: single randomize param
  randomize: parseAsString,

  // Edit mode: separate randomization params
  randomizePersonas: parseAsString,
  randomizeDocuments: parseAsString,
  randomizeParameters: parseAsString,

  // Dict types (JSON-encoded strings)
  fieldShowSelected: parseAsString, // JSON: Record<string, boolean>
  fieldRanges: parseAsString, // JSON: Record<string, { min: number; max: number }>
  randomizeParameterItems: parseAsString, // JSON: Record<string, string>
};

// Client-side parsers (same structure)
export const scenarioSearchParamsClient = {
  departmentIds: parseAsArrayOf(parseAsStringClient),
  personaIds: parseAsArrayOf(parseAsStringClient),
  documentIds: parseAsArrayOf(parseAsStringClient),
  templateDocumentIds: parseAsArrayOf(parseAsStringClient),
  parameterIds: parseAsArrayOf(parseAsStringClient),
  fieldIds: parseAsArrayOf(parseAsStringClient),

  imageIds: parseAsArrayOf(parseAsStringClient),
  objectiveIds: parseAsArrayOf(parseAsStringClient),
  problemStatementIds: parseAsArrayOf(parseAsStringClient),

  personaSearch: parseAsStringClient,
  documentSearch: parseAsStringClient,
  parameterSearch: parseAsStringClient,

  documentShowSelected: parseAsBooleanClient,
  documentShowTemplate: parseAsBooleanClient,
  personaShowSelected: parseAsBooleanClient,
  parameterShowSelected: parseAsBooleanClient,

  personaMin: parseAsIntegerClient,
  personaMax: parseAsIntegerClient,
  documentMin: parseAsIntegerClient,
  documentMax: parseAsIntegerClient,
  parameterSelectionMin: parseAsIntegerClient,
  parameterSelectionMax: parseAsIntegerClient,

  useImage: parseAsBooleanClient,
  useVideo: parseAsBooleanClient,
  useObjectives: parseAsBooleanClient,
  useQuestions: parseAsBooleanClient,
  useProblemStatement: parseAsBooleanClient,

  // Text fields
  name: parseAsStringClient,
  problemStatement: parseAsStringClient,
  objectives: parseAsStringClient, // JSON-encoded array: string[]
  videoLength: parseAsIntegerClient, // 4, 8, or 12

  randomize: parseAsStringClient,
  randomizePersonas: parseAsStringClient,
  randomizeDocuments: parseAsStringClient,
  randomizeParameters: parseAsStringClient,

  // Dict types (JSON-encoded strings)
  fieldShowSelected: parseAsStringClient, // JSON: Record<string, boolean>
  fieldRanges: parseAsStringClient, // JSON: Record<string, { min: number; max: number }>
  randomizeParameterItems: parseAsStringClient, // JSON: Record<string, string>
};

// Server-side loaders
export const loadScenarioSearchParams = createLoader(scenarioSearchParams);

// Helper functions to parse JSON-encoded dict params
export function parseJsonDict<T>(
  json: string | null | undefined,
  defaultValue: T
): T {
  if (!json) return defaultValue;
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as T;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function stringifyJsonDict<T>(
  dict: T | null | undefined
): string | null {
  if (!dict || (typeof dict === "object" && Object.keys(dict).length === 0)) {
    return null;
  }
  try {
    return JSON.stringify(dict);
  } catch {
    return null;
  }
}
