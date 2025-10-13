/**
 * Parameters V2 API Schemas
 * Schema definitions for parameters v2 endpoints with nested items
 */

import { z } from "zod";
import { DepartmentMappingSchema } from "./personas";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const ParametersFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type ParametersFilters = z.infer<typeof ParametersFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Parameter item (normalized)
export const ParameterItemSchema = z.object({
  parameter_id: z.string(),
  name: z.string(),
  description: z.string(),
  numerical: z.boolean(),
  active: z.boolean(),
  default_parameter: z.boolean(),
  num_items: z.number(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_duplicate: z.boolean(),
});

export const ParametersListResponseSchema = z.object({
  parameters: z.array(ParameterItemSchema),
});

export type ParametersListResponse = z.infer<
  typeof ParametersListResponseSchema
>;
export type ParameterItem = z.infer<typeof ParameterItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const ParameterDetailRequestSchema = z.object({
  parameterId: z.string(),
  profileId: z.string(),
});

export type ParameterDetailRequest = z.infer<
  typeof ParameterDetailRequestSchema
>;

// Nested parameter item detail
export const ParameterItemDetailSchema = z.object({
  parameter_item_id: z.string(),
  name: z.string(),
  description: z.string(),
  value: z.string(),
  default_item: z.boolean(),
  can_delete: z.boolean(), // Check if in use
});

export type ParameterItemDetail = z.infer<typeof ParameterItemDetailSchema>;

export const ParameterDetailResponseSchema = z.object({
  // Parameter fields
  name: z.string(),
  description: z.string(),
  numerical: z.boolean(),
  active: z.boolean(),
  default_parameter: z.boolean(),
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),

  // Nested parameter items
  parameter_items: z.array(ParameterItemDetailSchema),

  // Top-level mappings
  department_mapping: DepartmentMappingSchema,
});

export type ParameterDetailResponse = z.infer<
  typeof ParameterDetailResponseSchema
>;

// Default detail request
export const ParameterDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type ParameterDetailDefaultRequest = z.infer<
  typeof ParameterDetailDefaultRequestSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Nested parameter item for create/update
export const ParameterItemCreateSchema = z.object({
  name: z.string(),
  description: z.string(),
  value: z.string(),
  default_item: z.boolean(),
});

export type ParameterItemCreate = z.infer<typeof ParameterItemCreateSchema>;

// Create request
export const CreateParameterRequestSchema = z.object({
  name: z.string(),
  description: z.string(),
  numerical: z.boolean(),
  active: z.boolean(),
  default_parameter: z.boolean(),
  department_id: z.string(),
  parameter_items: z.array(ParameterItemCreateSchema),
});

export type CreateParameterRequest = z.infer<
  typeof CreateParameterRequestSchema
>;

export const CreateParameterResponseSchema = z.object({
  success: z.boolean(),
  parameterId: z.string(),
  message: z.string(),
});

export type CreateParameterResponse = z.infer<
  typeof CreateParameterResponseSchema
>;

// Update request
export const UpdateParameterRequestSchema = z.object({
  parameterId: z.string(),
  name: z.string(),
  description: z.string(),
  numerical: z.boolean(),
  active: z.boolean(),
  default_parameter: z.boolean(),
  department_id: z.string(),
  parameter_items: z.array(ParameterItemCreateSchema),
});

export type UpdateParameterRequest = z.infer<
  typeof UpdateParameterRequestSchema
>;

export const UpdateParameterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateParameterResponse = z.infer<
  typeof UpdateParameterResponseSchema
>;

// Duplicate request
export const DuplicateParameterRequestSchema = z.object({
  parameterId: z.string(),
});

export type DuplicateParameterRequest = z.infer<
  typeof DuplicateParameterRequestSchema
>;

export const DuplicateParameterResponseSchema = z.object({
  success: z.boolean(),
  parameterId: z.string(),
  message: z.string(),
});

export type DuplicateParameterResponse = z.infer<
  typeof DuplicateParameterResponseSchema
>;

// Delete request
export const DeleteParameterRequestSchema = z.object({
  parameterId: z.string(),
});

export type DeleteParameterRequest = z.infer<
  typeof DeleteParameterRequestSchema
>;

export const DeleteParameterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteParameterResponse = z.infer<
  typeof DeleteParameterResponseSchema
>;
