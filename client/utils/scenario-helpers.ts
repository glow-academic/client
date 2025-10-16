/**
 * Helper utilities for scenario data transformations
 * Used to convert between v2 API format and component state
 */

import type { ParameterDetail } from "@/lib/api/v2/schemas/scenarios";

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
 * Extract flat parameter item IDs from v2 parameters structure
 * The v2 API returns parameters grouped by parameter_id with nested item IDs
 */
export function getParameterItemIdsFromStructure(
  parameters: Record<string, ParameterDetail>
): string[] {
  return Object.values(parameters).flatMap((p) => p.parameter_item_ids);
}

/**
 * Group parameter item IDs by parameter ID for v2 API submission
 * This is needed when creating/updating scenarios via the v2 API
 */
export function groupParameterItemsByParameterId(
  parameterItemIds: string[],
  parameterItemMapping: Record<string, { parameter_id: string }>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const itemId of parameterItemIds) {
    const item = parameterItemMapping[itemId];
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
  objectiveMapping: Record<string, { name: string }>
): string[] {
  return objectiveIds.map((id) => objectiveMapping[id]?.name || "");
}

/**
 * Get all valid parameter item IDs from the parameters structure
 * This includes all available parameter items across all parameters
 */
export function getAllValidParameterItemIds(
  parameters: Record<string, ParameterDetail>
): string[] {
  const allIds = new Set<string>();

  for (const param of Object.values(parameters)) {
    for (const itemId of param.valid_parameter_item_ids) {
      allIds.add(itemId);
    }
  }

  return Array.from(allIds);
}
