/**
 * Server-side search params schema for scenario pages
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

// Server-side parsers for both create and edit modes
export const scenarioSearchParams = {
  // Draft ID (URL-backed, updated when draft is created)
  draftId: parseAsString,
  // ID arrays (using nuqs array parsing)
  departmentIds: parseAsArrayOf(parseAsString),
  personaIds: parseAsArrayOf(parseAsString),
  documentIds: parseAsArrayOf(parseAsString),
  templateDocumentIds: parseAsArrayOf(parseAsString),
  parameterIds: parseAsArrayOf(parseAsString),
  fieldIds: parseAsArrayOf(parseAsString),

  // Generated resources IDs
  imageIds: parseAsArrayOf(parseAsString),
  objectiveIds: parseAsArrayOf(parseAsString),
  problemStatementIds: parseAsArrayOf(parseAsString),

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

// Helper to convert nuqs array parser result to array or null
export function csvToArray<T>(value: T[] | null | undefined): T[] | null {
  if (!value || value.length === 0) return null;
  return value;
}

// Helper to extract field ranges from URL search params
export function extractFieldRanges(
  searchParams: URLSearchParams
): Record<string, { min: number; max: number }> | null {
  const fieldRangesStr = searchParams.get("fieldRanges");
  if (!fieldRangesStr) return null;
  try {
    const parsed = JSON.parse(fieldRangesStr);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, { min: number; max: number }>;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to extract field show selected by param from URL search params
export function extractFieldShowSelectedByParam(
  searchParams: URLSearchParams
): Record<string, boolean> | null {
  const fieldShowSelectedStr = searchParams.get("fieldShowSelected");
  if (!fieldShowSelectedStr) return null;
  try {
    const parsed = JSON.parse(fieldShowSelectedStr);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, boolean>;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to extract parameter item ranges from URL search params
export function extractParameterItemRanges(
  searchParams: URLSearchParams
): Record<string, { min: number; max: number }> | null {
  return extractFieldRanges(searchParams); // Same as field ranges
}
