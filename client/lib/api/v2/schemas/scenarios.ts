/**
 * Scenarios V2 API Schemas
 * Schema definitions for scenarios v2 endpoints
 */

import { z } from "zod";
import {
  CohortMappingSchema,
  DepartmentMappingSchema,
  DocumentMappingSchema,
  ObjectiveMappingSchema,
  ParameterItemMappingSchema,
  ParameterMappingSchema,
  PersonaMappingSchema,
  SimulationMappingSchema,
} from "./base";
import { DocumentItemSchema } from "./documents";

// ============================================================================
// NO SCENARIO-SPECIFIC MAPPING TYPES - All use base MappingSchema
// ============================================================================

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const ScenariosFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type ScenariosFilters = z.infer<typeof ScenariosFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Scenario item (normalized - IDs only)
export const ScenarioItemSchema = z.object({
  scenario_id: z.string(),
  title: z.string(), // Maps to scenarios.name
  problem_statement: z.string(),
  active: z.boolean(),
  default_scenario: z.boolean(),
  generated: z.boolean(),
  parent_scenario_id: z.string().nullable(),
  objective_ids: z.array(z.string()), // "scenarioId_idx" composite keys
  persona_id: z.string().nullable(),
  parameter_item_ids: z.array(z.string()),
  simulation_ids: z.array(z.string()),
  num_simulations: z.number(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_duplicate: z.boolean(),
  cohort_ids: z.array(z.string()),
});

export const ScenariosListResponseSchema = z.object({
  scenarios: z.array(ScenarioItemSchema),
  objective_mapping: ObjectiveMappingSchema,
  parameter_item_mapping: ParameterItemMappingSchema,
  cohort_mapping: CohortMappingSchema,
  persona_mapping: PersonaMappingSchema,
});

export type ScenariosListResponse = z.infer<typeof ScenariosListResponseSchema>;
export type ScenarioItem = z.infer<typeof ScenarioItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const ScenarioDetailRequestSchema = z.object({
  scenarioId: z.string(),
  profileId: z.string(),
});

export type ScenarioDetailRequest = z.infer<typeof ScenarioDetailRequestSchema>;

// Parameter detail structure
export const ParameterDetailSchema = z.object({
  parameter_item_ids: z.array(z.string()), // Selected items
  valid_parameter_item_ids: z.array(z.string()), // Available items
});

export const ScenarioDetailResponseSchema = z.object({
  // Basic fields
  name: z.string(),
  problem_statement: z.string(),
  active: z.boolean(),
  default_scenario: z.boolean(),
  generated: z.boolean(),
  parent_scenario_id: z.string().nullable(),

  // Department
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),

  // IDs
  persona_id: z.string().nullable(),
  valid_persona_ids: z.array(z.string()),
  document_ids: z.array(z.string()),
  valid_document_ids: z.array(z.string()),

  // Objectives (use IDs)
  objective_ids: z.array(z.string()), // "scenarioId_idx" composite keys
  valid_objectives: z.array(z.string()), // Empty (free-form)

  // Parameters (structured by parameter_id)
  parameters: z.record(z.string(), ParameterDetailSchema),

  // Simulations
  active_simulation_ids: z.array(z.string()),

  // Document details (full objects for preview)
  document_details: z.array(DocumentItemSchema),

  // Permissions
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),

  // Top-level mappings
  parameter_mapping: ParameterMappingSchema,
  parameter_item_mapping: ParameterItemMappingSchema,
  simulation_mapping: SimulationMappingSchema,
  persona_mapping: PersonaMappingSchema,
  document_mapping: DocumentMappingSchema,
  objective_mapping: ObjectiveMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type ScenarioDetailResponse = z.infer<
  typeof ScenarioDetailResponseSchema
>;
export type ParameterDetail = z.infer<typeof ParameterDetailSchema>;

// Default detail request
export const ScenarioDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type ScenarioDetailDefaultRequest = z.infer<
  typeof ScenarioDetailDefaultRequestSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Create request
export const CreateScenarioRequestSchema = z.object({
  name: z.string(),
  problem_statement: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_scenario: z.boolean(),
  persona_id: z.string().nullable(),
  document_ids: z.array(z.string()),
  objective_ids: z.array(z.string()), // Can be composite IDs or raw text
  parameters: z.record(z.string(), z.array(z.string())), // { parameter_id: [parameter_item_ids] }
});

export type CreateScenarioRequest = z.infer<typeof CreateScenarioRequestSchema>;

export const CreateScenarioResponseSchema = z.object({
  success: z.boolean(),
  scenarioId: z.string(),
  message: z.string(),
});

export type CreateScenarioResponse = z.infer<
  typeof CreateScenarioResponseSchema
>;

// Update request
export const UpdateScenarioRequestSchema = z.object({
  scenarioId: z.string(),
  name: z.string(),
  problem_statement: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_scenario: z.boolean(),
  persona_id: z.string().nullable(),
  document_ids: z.array(z.string()),
  objective_ids: z.array(z.string()),
  parameters: z.record(z.string(), z.array(z.string())),
});

export type UpdateScenarioRequest = z.infer<typeof UpdateScenarioRequestSchema>;

export const UpdateScenarioResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateScenarioResponse = z.infer<
  typeof UpdateScenarioResponseSchema
>;

// Duplicate request
export const DuplicateScenarioRequestSchema = z.object({
  scenarioId: z.string(),
});

export type DuplicateScenarioRequest = z.infer<
  typeof DuplicateScenarioRequestSchema
>;

export const DuplicateScenarioResponseSchema = z.object({
  success: z.boolean(),
  scenarioId: z.string(),
  message: z.string(),
});

export type DuplicateScenarioResponse = z.infer<
  typeof DuplicateScenarioResponseSchema
>;

// Delete request
export const DeleteScenarioRequestSchema = z.object({
  scenarioId: z.string(),
});

export type DeleteScenarioRequest = z.infer<typeof DeleteScenarioRequestSchema>;

export const DeleteScenarioResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteScenarioResponse = z.infer<
  typeof DeleteScenarioResponseSchema
>;

// ============================================================================
// AI GENERATION AND RANDOMIZATION
// ============================================================================

export const GenerateScenarioAIRequestSchema = z.object({
  departmentId: z.string(),
  personaId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  parameterItemIds: z.array(z.string()).optional(),
  profileId: z.string().optional(),
});

export type GenerateScenarioAIRequest = z.infer<
  typeof GenerateScenarioAIRequestSchema
>;

export const GenerateScenarioAIResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  title: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
});

export type GenerateScenarioAIResponse = z.infer<
  typeof GenerateScenarioAIResponseSchema
>;

export const RandomizeScenarioRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  personaId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  parameterItemIds: z.array(z.string()).optional(),
  targets: z.array(z.string()),
});

export type RandomizeScenarioRequest = z.infer<
  typeof RandomizeScenarioRequestSchema
>;

export const RandomizeScenarioResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  personaId: z.string().optional(),
  documentIds: z.array(z.string()),
  parameterItemIds: z.array(z.string()),
});

export type RandomizeScenarioResponse = z.infer<
  typeof RandomizeScenarioResponseSchema
>;
