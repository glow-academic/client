/**
 * Base schemas and types for v2 API
 * Centralized mapping types used across all resources
 */

import { z } from "zod";

/**
 * Standard mapping item with name and description
 * Used universally across ALL resources for consistency
 * - For scenarios: description = problem_statement
 * - For models: description = model description or empty string
 * - For all others: description = natural description
 */
export const MappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type MappingItem = z.infer<typeof MappingItemSchema>;

/**
 * Enhanced parameter item mapping with parameter context
 */
export const ParameterItemMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameter_id: z.string(),
  parameter_name: z.string(),
});

export type ParameterItemMappingItem = z.infer<typeof ParameterItemMappingItemSchema>;

/**
 * Custom persona mapping item with additional color and icon fields
 */
export const PersonaMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
});

export type PersonaMappingItem = z.infer<typeof PersonaMappingItemSchema>;

/**
 * Generic mapping schema - id maps to { name, description }
 * This is the universal mapping type used throughout the application
 */
export const MappingSchema = z.record(z.string(), MappingItemSchema);

export type Mapping = z.infer<typeof MappingSchema>;

/**
 * Specific mapping schemas for each resource
 * All currently use the same MappingSchema, but are exported separately
 * for future extensibility (e.g., if ScenarioMappingSchema needs custom fields)
 */
/**
 * Enhanced scenario mapping item with nested data
 */
export const ScenarioMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  persona_id: z.string().nullable(),
  persona_mapping: z.lazy(() => PersonaMappingSchema),
  document_mapping: z.lazy(() => DocumentMappingSchema),
  parameter_item_mapping: z.lazy(() => ParameterItemMappingSchema),
  parameter_item_ids: z.array(z.string()),
});

export type ScenarioMappingItem = z.infer<typeof ScenarioMappingItemSchema>;

export const DepartmentMappingSchema = MappingSchema;
export const PersonaMappingSchema = z.record(
  z.string(),
  PersonaMappingItemSchema
); // Custom with color and icon
export const RubricMappingSchema = MappingSchema;
export const SimulationMappingSchema = MappingSchema;
export const ParameterMappingSchema = MappingSchema;
export const CohortMappingSchema = MappingSchema;
export const DocumentMappingSchema = MappingSchema;
export const StaffMappingSchema = MappingSchema;
export const AgentMappingSchema = MappingSchema;
export const ProviderMappingSchema = MappingSchema;
export const ScenarioMappingSchema = z.record(z.string(), ScenarioMappingItemSchema);
export const ModelMappingSchema = MappingSchema;
export const ParameterItemMappingSchema = z.record(z.string(), ParameterItemMappingItemSchema);
export const ObjectiveMappingSchema = MappingSchema;
export const ProfileMappingSchema = MappingSchema;
export const StandardGroupsMappingSchema = MappingSchema;
export const StandardsMappingSchema = MappingSchema;

/**
 * Type aliases for convenience
 */
export type DepartmentMapping = z.infer<typeof DepartmentMappingSchema>;
export type PersonaMapping = z.infer<typeof PersonaMappingSchema>;
export type RubricMapping = z.infer<typeof RubricMappingSchema>;
export type SimulationMapping = z.infer<typeof SimulationMappingSchema>;
export type ParameterMapping = z.infer<typeof ParameterMappingSchema>;
export type CohortMapping = z.infer<typeof CohortMappingSchema>;
export type DocumentMapping = z.infer<typeof DocumentMappingSchema>;
export type StaffMapping = z.infer<typeof StaffMappingSchema>;
export type AgentMapping = z.infer<typeof AgentMappingSchema>;
export type ProviderMapping = z.infer<typeof ProviderMappingSchema>;
export type ScenarioMapping = z.infer<typeof ScenarioMappingSchema>;
export type ModelMapping = z.infer<typeof ModelMappingSchema>;
export type ParameterItemMapping = z.infer<typeof ParameterItemMappingSchema>;
export type ObjectiveMapping = z.infer<typeof ObjectiveMappingSchema>;
export type ProfileMapping = z.infer<typeof ProfileMappingSchema>;
export type StandardGroupsMapping = z.infer<typeof StandardGroupsMappingSchema>;
export type StandardsMapping = z.infer<typeof StandardsMappingSchema>;
