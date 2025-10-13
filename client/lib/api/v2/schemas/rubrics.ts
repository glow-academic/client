/**
 * Rubrics V2 API Schemas
 * Schema definitions for rubrics v2 endpoints with hierarchical structure
 */

import { z } from "zod";
import { DepartmentMappingSchema } from "./personas";

// ============================================================================
// CENTRALIZED MAPPING TYPES (rubric-specific)
// ============================================================================

export const StandardGroupMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
  passPoints: z.number(),
});

export type StandardGroupMappingItem = z.infer<
  typeof StandardGroupMappingItemSchema
>;

export const StandardMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
});

export type StandardMappingItem = z.infer<typeof StandardMappingItemSchema>;

export const StandardGroupsMappingSchema = z.record(
  z.string(),
  StandardGroupMappingItemSchema
);
export const StandardsMappingSchema = z.record(
  z.string(),
  StandardMappingItemSchema
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

export const StandardGroupsMappingDetailSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type StandardGroupsMappingDetail = z.infer<
  typeof StandardGroupsMappingDetailSchema
>;

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

  // Standard groups structure
  standard_group_ids: z.array(z.string()),
  standard_groups_detail: z.record(z.string(), StandardGroupDetailSchema),

  // Top-level mappings
  standard_groups_mapping: z.record(
    z.string(),
    StandardGroupsMappingDetailSchema
  ),
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

// Update request
export const UpdateRubricRequestSchema = z.object({
  rubricId: z.string(),
  name: z.string(),
  description: z.string(),
  department_id: z.string(),
  active: z.boolean(),
  default_rubric: z.boolean(),
  points: z.number(),
  passPoints: z.number(),
  standard_groups: z.array(StandardGroupCreateSchema),
});

export type UpdateRubricRequest = z.infer<typeof UpdateRubricRequestSchema>;

export const UpdateRubricResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
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
