/**
 * Helper utilities for scenario data transformations
 * Used to work with parameter structures from v3 API
 */

// ParameterDetail type (matches v3 API structure from scenarios/detail)
export interface ParameterDetail {
  field_ids: string[]; // Renamed from parameter_item_ids for readability
  valid_field_ids: string[]; // Renamed from valid_parameter_item_ids
}

// Type definitions (merged from scenario.ts)
export type ModelType = "Personas" | "Documents" | "Classes" | "Seniority";

export interface Model {
  id: string;
  name: string;
  description: string;
  type: ModelType;
  strengths?: string;
}

/**
 * Extract flat field IDs from parameters structure
 * The API returns parameters grouped by parameter_id with nested field IDs
 */
export function getFieldIdsFromStructure( // Renamed from getParameterItemIdsFromStructure
  parameters: Record<string, ParameterDetail>,
): string[] {
  return Object.values(parameters).flatMap((p) => p.field_ids); // Renamed from parameter_item_ids
}

/**
 * Group field IDs by parameter ID for API submission
 * This is needed when creating/updating scenarios via the API
 */
export function groupFieldsByParameterId( // Renamed from groupParameterItemsByParameterId
  fieldIds: string[], // Renamed from parameterItemIds
  fieldMapping: Record<string, { parameter_id: string }>, // Renamed from parameterItemMapping
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const itemId of fieldIds) {
    const item = fieldMapping[itemId];
    if (item) {
      const parameterId = item.parameter_id;
      if (!grouped[parameterId]) {
        grouped[parameterId] = [];
      }
      grouped[parameterId].push(itemId);
    }
  }

  return grouped;
}

/**
 * Extract objective text values from composite IDs and mapping
 * The v2 API uses composite IDs like "scenarioId_idx" for objectives
 */
export function getObjectivesFromMapping(
  objectiveIds: string[],
  objectiveMapping: Record<string, { name: string }>,
): string[] {
  return objectiveIds.map((id) => objectiveMapping[id]?.name || "");
}

/**
 * Get all valid field IDs from the parameters structure
 * This includes all available fields across all parameters
 */
export function getAllValidFieldIds( // Renamed from getAllValidParameterItemIds
  parameters: Record<string, ParameterDetail>,
): string[] {
  const allIds = new Set<string>();

  for (const param of Object.values(parameters)) {
    for (const itemId of param.valid_field_ids) {
      // Renamed from valid_parameter_item_ids
      allIds.add(itemId);
    }
  }

  return Array.from(allIds);
}
