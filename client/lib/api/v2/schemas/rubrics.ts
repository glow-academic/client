/**
 * Rubrics V2 API Schemas
 * Schema definitions for rubrics v2 endpoints with hierarchical structure
 */

import { z } from "zod";
import { DepartmentMappingSchema } from "./base";

// Custom mapping schemas for rubrics (include points unlike base)
export const StandardGroupMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
  passPoints: z.number(),
});

export const StandardMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
});

export const StandardGroupMappingDetailSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const StandardGroupsMappingSchema = z.record(
  z.string(),
  StandardGroupMappingItemSchema
);
export const StandardsMappingSchema = z.record(
  z.string(),
  StandardMappingItemSchema
);
export const StandardGroupsMappingDetailSchema = z.record(
  z.string(),
  StandardGroupMappingDetailSchema
);

export type StandardGroupsMapping = z.infer<typeof StandardGroupsMappingSchema>;
export type StandardsMapping = z.infer<typeof StandardsMappingSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const RubricsFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type RubricsFilters = z.infer<typeof RubricsFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Rubric item (normalized - IDs only with hierarchical structure)
export const RubricItemSchema = z.object({
  rubric_id: z.string(),
  name: z.string(),
  description: z.string(),
  points: z.number(),
  passPoints: z.number(),
  default_rubric: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_duplicate: z.boolean(),
  // Hierarchical structure: standard_group_id -> array of standard_ids
  standard_groups: z.record(z.string(), z.array(z.string())),
});

export const RubricsListResponseSchema = z.object({
  rubrics: z.array(RubricItemSchema),
  standard_groups_mapping: StandardGroupsMappingSchema,
  standards_mapping: StandardsMappingSchema,
});

export type RubricsListResponse = z.infer<typeof RubricsListResponseSchema>;
export type RubricItem = z.infer<typeof RubricItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const RubricDetailRequestSchema = z.object({
  rubricId: z.string(),
  profileId: z.string(),
});

export type RubricDetailRequest = z.infer<typeof RubricDetailRequestSchema>;

export const StandardGroupDetailSchema = z.object({
  points: z.number(),
  passPoints: z.number(),
  standard_ids: z.array(z.string()),
});

export type StandardGroupDetail = z.infer<typeof StandardGroupDetailSchema>;

export const RubricDetailResponseSchema = z.object({
  // Basic fields
  name: z.string(),
  description: z.string(),
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),
  points: z.number(),
  passPoints: z.number(),
  active: z.boolean(),
  default_rubric: z.boolean(),
  can_edit: z.boolean(), // Permission flag for editing

  // Standard groups structure
  standard_group_ids: z.array(z.string()),
  standard_groups_detail: z.record(z.string(), StandardGroupDetailSchema),

  // Top-level mappings
  standard_groups_mapping: StandardGroupsMappingDetailSchema,
  standards_mapping: StandardsMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type RubricDetailResponse = z.infer<typeof RubricDetailResponseSchema>;

// Default detail request
export const RubricDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type RubricDetailDefaultRequest = z.infer<
  typeof RubricDetailDefaultRequestSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Nested standard schema for create/update
export const StandardCreateSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
});

export type StandardCreate = z.infer<typeof StandardCreateSchema>;

// Standard update schema for incremental updates
export const StandardUpdateSchema = z.object({
  id: z.string().optional(), // Present for updates, absent for creates
  name: z.string(),
  description: z.string(),
  points: z.number(),
  deleted: z.boolean().default(false), // Mark for deletion
});

export type StandardUpdate = z.infer<typeof StandardUpdateSchema>;

// Nested standard group schema for create/update
export const StandardGroupCreateSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  description: z.string(),
  points: z.number(),
  passPoints: z.number(),
  standards: z.array(StandardCreateSchema),
});

export type StandardGroupCreate = z.infer<typeof StandardGroupCreateSchema>;

// Standard group update schema for incremental updates
export const StandardGroupUpdateSchema = z.object({
  id: z.string().optional(), // Present for updates, absent for creates
  name: z.string(),
  short_name: z.string(),
  description: z.string(),
  points: z.number(),
  passPoints: z.number(),
  standards: z.array(StandardUpdateSchema),
  deleted: z.boolean().default(false), // Mark for deletion
});

export type StandardGroupUpdate = z.infer<typeof StandardGroupUpdateSchema>;

// Create request
export const CreateRubricRequestSchema = z.object({
  name: z.string(),
  description: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_rubric: z.boolean(),
  points: z.number(),
  passPoints: z.number(),
  standard_groups: z.array(StandardGroupCreateSchema),
});

export type CreateRubricRequest = z.infer<typeof CreateRubricRequestSchema>;

export const CreateRubricResponseSchema = z.object({
  success: z.boolean(),
  rubricId: z.string(),
  message: z.string(),
});

export type CreateRubricResponse = z.infer<typeof CreateRubricResponseSchema>;

// Update request - uses StandardGroupUpdate for incremental updates
export const UpdateRubricRequestSchema = z.object({
  rubricId: z.string(),
  name: z.string(),
  description: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_rubric: z.boolean(),
  standard_groups: z.array(StandardGroupUpdateSchema),
  // points and passPoints are auto-calculated by server
});

export type UpdateRubricRequest = z.infer<typeof UpdateRubricRequestSchema>;

export const UpdateRubricResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  points: z.number(), // Auto-calculated from standard groups
  passPoints: z.number(), // Auto-calculated from standard groups
});

export type UpdateRubricResponse = z.infer<typeof UpdateRubricResponseSchema>;

// Duplicate request
export const DuplicateRubricRequestSchema = z.object({
  rubricId: z.string(),
});

export type DuplicateRubricRequest = z.infer<
  typeof DuplicateRubricRequestSchema
>;

export const DuplicateRubricResponseSchema = z.object({
  success: z.boolean(),
  rubricId: z.string(),
  message: z.string(),
});

export type DuplicateRubricResponse = z.infer<
  typeof DuplicateRubricResponseSchema
>;

// Delete request
export const DeleteRubricRequestSchema = z.object({
  rubricId: z.string(),
});

export type DeleteRubricRequest = z.infer<typeof DeleteRubricRequestSchema>;

export const DeleteRubricResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteRubricResponse = z.infer<typeof DeleteRubricResponseSchema>;
