/**
 * Simulations V2 API Schemas
 * Schema definitions for simulations v2 endpoints
 */

import { z } from "zod";
import {
  DepartmentMappingSchema,
  RubricMappingSchema,
  ScenarioMappingSchema,
} from "./base";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const SimulationsFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type SimulationsFilters = z.infer<typeof SimulationsFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Simulation item (normalized - IDs only)
export const SimulationItemSchema = z.object({
  simulation_id: z.string(),
  name: z.string(), // Maps to simulations.title
  description: z.string(),
  time_limit: z.number().nullable(),
  active: z.boolean(),
  default_simulation: z.boolean(),
  practice_simulation: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_duplicate: z.boolean(),
  num_scenarios: z.number(),
  scenario_ids: z.array(z.string()),
  rubric_id: z.string(),
});

export const SimulationsListResponseSchema = z.object({
  simulations: z.array(SimulationItemSchema),
  scenario_mapping: ScenarioMappingSchema,
  rubric_mapping: RubricMappingSchema,
});

export type SimulationsListResponse = z.infer<
  typeof SimulationsListResponseSchema
>;
export type SimulationItem = z.infer<typeof SimulationItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const SimulationDetailRequestSchema = z.object({
  simulationId: z.string(),
  profileId: z.string(),
});

export type SimulationDetailRequest = z.infer<
  typeof SimulationDetailRequestSchema
>;

// Scenario in simulation with position
export const ScenarioInSimulationSchema = z.object({
  scenario_id: z.string(),
  title: z.string(),
  description: z.string(),
  active: z.boolean(),
  default_scenario: z.boolean(),
  position: z.number(),
  parameter_item_ids: z.array(z.string()),
});

// Parameter item schemas
export const ParameterItemSchema = z.object({
  id: z.string(),
  parameter_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export const ParameterItemDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parameter_id: z.string(),
});

// Parameter mapping
export const ParameterMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const ParameterMappingSchema = z.record(
  z.string(),
  ParameterMappingItemSchema
);

// Parameter item mapping
export const ParameterItemMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameter_id: z.string(),
  parameter_name: z.string(),
});

export const ParameterItemMappingSchema = z.record(
  z.string(),
  ParameterItemMappingItemSchema
);

export const SimulationDetailResponseSchema = z.object({
  // Basic fields
  name: z.string(), // Maps to simulations.title
  description: z.string(),
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),
  time_limit: z.number().nullable(),
  rubric_id: z.string(),
  valid_rubric_ids: z.array(z.string()),
  scenario_ids: z.array(z.string()),
  valid_scenario_ids: z.array(z.string()),

  // Boolean parameters
  active: z.boolean(),
  default_simulation: z.boolean(),
  practice_simulation: z.boolean(),
  hints_enabled: z.boolean(),
  input_guardrail_active: z.boolean(),
  output_guardrail_active: z.boolean(),
  image_input_active: z.boolean(),

  // Permission flags
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),

  // Usage status
  in_use: z.boolean(),
  cohort_count: z.number(),

  // Full scenario objects (ordered by position)
  scenarios: z.array(ScenarioInSimulationSchema),

  // Parameter data for scenario picker
  parameters: z.array(ParameterItemSchema),
  parameter_items: z.array(ParameterItemDetailSchema),
  parameter_mapping: ParameterMappingSchema,

  // Top-level mappings
  scenario_mapping: ScenarioMappingSchema,
  rubric_mapping: RubricMappingSchema,
  department_mapping: DepartmentMappingSchema,
  parameter_item_mapping: ParameterItemMappingSchema,
});

export type SimulationDetailResponse = z.infer<
  typeof SimulationDetailResponseSchema
>;

// Default detail request
export const SimulationDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type SimulationDetailDefaultRequest = z.infer<
  typeof SimulationDetailDefaultRequestSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Create request
export const CreateSimulationRequestSchema = z.object({
  title: z.string(),
  description: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_simulation: z.boolean(),
  practice_simulation: z.boolean(),
  hints_enabled: z.boolean(),
  input_guardrail_active: z.boolean(),
  output_guardrail_active: z.boolean(),
  image_input_active: z.boolean(),
  time_limit: z.number().nullable(),
  rubric_id: z.string(),
  scenario_ids: z.array(z.string()),
});

export type CreateSimulationRequest = z.infer<
  typeof CreateSimulationRequestSchema
>;

export const CreateSimulationResponseSchema = z.object({
  success: z.boolean(),
  simulationId: z.string(),
  message: z.string(),
});

export type CreateSimulationResponse = z.infer<
  typeof CreateSimulationResponseSchema
>;

// Update request
export const UpdateSimulationRequestSchema = z.object({
  simulationId: z.string(),
  title: z.string(),
  description: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_simulation: z.boolean(),
  practice_simulation: z.boolean(),
  hints_enabled: z.boolean(),
  input_guardrail_active: z.boolean(),
  output_guardrail_active: z.boolean(),
  image_input_active: z.boolean(),
  time_limit: z.number().nullable(),
  rubric_id: z.string(),
  scenario_ids: z.array(z.string()),
});

export type UpdateSimulationRequest = z.infer<
  typeof UpdateSimulationRequestSchema
>;

export const UpdateSimulationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateSimulationResponse = z.infer<
  typeof UpdateSimulationResponseSchema
>;

// Duplicate request
export const DuplicateSimulationRequestSchema = z.object({
  simulationId: z.string(),
});

export type DuplicateSimulationRequest = z.infer<
  typeof DuplicateSimulationRequestSchema
>;

export const DuplicateSimulationResponseSchema = z.object({
  success: z.boolean(),
  simulationId: z.string(),
  message: z.string(),
});

export type DuplicateSimulationResponse = z.infer<
  typeof DuplicateSimulationResponseSchema
>;

// Delete request
export const DeleteSimulationRequestSchema = z.object({
  simulationId: z.string(),
});

export type DeleteSimulationRequest = z.infer<
  typeof DeleteSimulationRequestSchema
>;

export const DeleteSimulationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteSimulationResponse = z.infer<
  typeof DeleteSimulationResponseSchema
>;
