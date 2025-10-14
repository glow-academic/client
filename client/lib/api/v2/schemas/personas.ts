/**
 * Personas V2 API Schemas
 * Schema definitions for personas v2 endpoints
 */

import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const PersonasFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type PersonasFilters = z.infer<typeof PersonasFiltersSchema>;

// ============================================================================
// CENTRALIZED MAPPING TYPES (reusable across v2 services)
// ============================================================================

export const DepartmentMappingItemSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
});

export const ModelMappingSchema = z.record(z.string(), z.string()); // model_id -> name
export const ScenarioMappingSchema = z.record(z.string(), z.string()); // scenario_id -> name
export const PersonaMappingSchema = z.record(z.string(), z.string()); // persona_id -> name
export const DepartmentMappingSchema = z.record(
  z.string(),
  DepartmentMappingItemSchema
); // department_id -> {name, description}

export type ModelMapping = z.infer<typeof ModelMappingSchema>;
export type ScenarioMapping = z.infer<typeof ScenarioMappingSchema>;
export type PersonaMapping = z.infer<typeof PersonaMappingSchema>;
export type DepartmentMapping = z.infer<typeof DepartmentMappingSchema>;
export type DepartmentMappingItem = z.infer<typeof DepartmentMappingItemSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Persona item (normalized - no nested objects, just IDs)
export const PersonaItemSchema = z.object({
  persona_id: z.string(),
  name: z.string(), // Added name back
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string(),
  scenario_ids: z.array(z.string()), // Array of scenario IDs
  model_id: z.string(),
  reasoning: z.string().nullable(),
  temperature: z.number(),
  active: z.boolean(),
  num_scenarios: z.number(),
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),
});

// Response Schema (normalized with top-level mappings, no persona_mapping)
export const PersonasListResponseSchema = z.object({
  personas: z.array(PersonaItemSchema),
  scenario_mapping: ScenarioMappingSchema,
  model_mapping: ModelMappingSchema,
});

export type PersonasListResponse = z.infer<typeof PersonasListResponseSchema>;
export type PersonaItem = z.infer<typeof PersonaItemSchema>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Duplicate request
export const DuplicatePersonaRequestSchema = z.object({
  personaId: z.string(),
});

export type DuplicatePersonaRequest = z.infer<
  typeof DuplicatePersonaRequestSchema
>;

// Duplicate response
export const DuplicatePersonaResponseSchema = z.object({
  success: z.boolean(),
  personaId: z.string(),
  message: z.string(),
});

export type DuplicatePersonaResponse = z.infer<
  typeof DuplicatePersonaResponseSchema
>;

// Delete request
export const DeletePersonaRequestSchema = z.object({
  personaId: z.string(),
});

export type DeletePersonaRequest = z.infer<typeof DeletePersonaRequestSchema>;

// Delete response
export const DeletePersonaResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeletePersonaResponse = z.infer<typeof DeletePersonaResponseSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

// Detail request
export const PersonaDetailRequestSchema = z.object({
  personaId: z.string(),
  profileId: z.string(),
});

export type PersonaDetailRequest = z.infer<typeof PersonaDetailRequestSchema>;

// Debug info item
export const DebugInfoItemSchema = z.object({
  created_at: z.string(),
  model_id: z.string(),
  content: z.string(),
});

export type DebugInfoItem = z.infer<typeof DebugInfoItemSchema>;

// Detail response
export const PersonaDetailResponseSchema = z.object({
  // Basic persona fields
  name: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),
  active: z.boolean(),
  default_persona: z.boolean(),
  color: z.string(),
  icon: z.string(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
  temperature: z.number(),
  system_prompt: z.string(),

  // Usage and permissions
  in_use: z.boolean(),
  scenario_count: z.number(),
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),

  // Metadata/Options
  preset_colors: z.array(z.string()),
  suggested_icons: z.array(z.string()),
  valid_icons: z.array(z.string()),
  valid_model_ids: z.array(z.string()),
  reasoning_options: z.array(z.string()),
  valid_department_ids: z.array(z.string()),
  temperature_lower: z.number(),
  temperature_upper: z.number(),

  // Mappings (using centralized types)
  model_mapping: ModelMappingSchema,
  department_mapping: DepartmentMappingSchema,

  // Debug info
  debug_info: z.array(DebugInfoItemSchema),
});

export type PersonaDetailResponse = z.infer<typeof PersonaDetailResponseSchema>;

// Default detail request (profile-based, no persona_id)
export const PersonaDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type PersonaDetailDefaultRequest = z.infer<
  typeof PersonaDetailDefaultRequestSchema
>;

// Response uses same PersonaDetailResponse schema

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

// Create request
export const CreatePersonaRequestSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),
  active: z.boolean(),
  default_persona: z.boolean(),
  color: z.string(),
  icon: z.string(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
  temperature: z.number(),
  system_prompt: z.string(),
});

export type CreatePersonaRequest = z.infer<typeof CreatePersonaRequestSchema>;

// Create response
export const CreatePersonaResponseSchema = z.object({
  success: z.boolean(),
  personaId: z.string(),
  message: z.string(),
});

export type CreatePersonaResponse = z.infer<typeof CreatePersonaResponseSchema>;

// Update request (same fields as create)
export const UpdatePersonaRequestSchema = z.object({
  personaId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),
  active: z.boolean(),
  default_persona: z.boolean(),
  color: z.string(),
  icon: z.string(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
  temperature: z.number(),
  system_prompt: z.string(),
});

export type UpdatePersonaRequest = z.infer<typeof UpdatePersonaRequestSchema>;

export const UpdatePersonaResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdatePersonaResponse = z.infer<typeof UpdatePersonaResponseSchema>;
