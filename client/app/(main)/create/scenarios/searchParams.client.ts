/**
 * Client-side search params schema for scenario pages
 * Uses nuqs for type-safe URL search param parsing
 * This file must be imported only by client components
 */

"use client";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs";

// Client-side parsers (same structure as server-side)
export const scenarioSearchParamsClient = {
  departmentIds: parseAsArrayOf(parseAsString),
  personaIds: parseAsArrayOf(parseAsString),
  documentIds: parseAsArrayOf(parseAsString),
  templateDocumentIds: parseAsArrayOf(parseAsString),
  parameterIds: parseAsArrayOf(parseAsString),
  fieldIds: parseAsArrayOf(parseAsString),

  imageIds: parseAsArrayOf(parseAsString),
  objectiveIds: parseAsArrayOf(parseAsString),
  problemStatementIds: parseAsArrayOf(parseAsString),

  personaSearch: parseAsString,
  documentSearch: parseAsString,
  parameterSearch: parseAsString,

  documentShowSelected: parseAsBoolean,
  documentShowTemplate: parseAsBoolean,
  personaShowSelected: parseAsBoolean,
  parameterShowSelected: parseAsBoolean,

  personaMin: parseAsInteger,
  personaMax: parseAsInteger,
  documentMin: parseAsInteger,
  documentMax: parseAsInteger,
  parameterSelectionMin: parseAsInteger,
  parameterSelectionMax: parseAsInteger,

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

  randomize: parseAsString,
  randomizePersonas: parseAsString,
  randomizeDocuments: parseAsString,
  randomizeParameters: parseAsString,

  // Dict types (JSON-encoded strings)
  fieldShowSelected: parseAsString, // JSON: Record<string, boolean>
  fieldRanges: parseAsString, // JSON: Record<string, { min: number; max: number }>
  randomizeParameterItems: parseAsString, // JSON: Record<string, string>
};
