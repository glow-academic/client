/**
 * Departments V2 API Schemas
 * Schema definitions for departments v2 endpoints
 */

import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const DepartmentsFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type DepartmentsFilters = z.infer<typeof DepartmentsFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Department item
export const DepartmentItemSchema = z.object({
  department_id: z.string(),
  title: z.string(),
  description: z.string(),
  active: z.boolean(),
  updated_at: z.string(),
  total_price_spent: z.number(),
  staff_count: z.number(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_duplicate: z.boolean(),
});

export const DepartmentsListResponseSchema = z.object({
  departments: z.array(DepartmentItemSchema),
});

export type DepartmentsListResponse = z.infer<
  typeof DepartmentsListResponseSchema
>;
export type DepartmentItem = z.infer<typeof DepartmentItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const DepartmentDetailRequestSchema = z.object({
  departmentId: z.string(),
  profileId: z.string(),
});

export type DepartmentDetailRequest = z.infer<
  typeof DepartmentDetailRequestSchema
>;

export const DepartmentDetailResponseSchema = z.object({
  // Basic fields
  title: z.string(),
  description: z.string(),
  active: z.boolean(),

  // Permissions
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),

  // Usage/Stats
  in_use: z.boolean(),
  staff_count: z.number(),
  total_price_spent: z.number(),

  // Staff list and mappings (for table display)
  staff: z.array(z.any()), // ProfileListItemSchema - using z.any() to avoid circular import
  cohort_mapping: z.record(
    z.string(),
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
  department_mapping: z.record(
    z.string(),
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
});

export type DepartmentDetailResponse = z.infer<
  typeof DepartmentDetailResponseSchema
>;

// Default detail request
export const DepartmentDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type DepartmentDetailDefaultRequest = z.infer<
  typeof DepartmentDetailDefaultRequestSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Create request
export const CreateDepartmentRequestSchema = z.object({
  title: z.string(),
  description: z.string(),
  active: z.boolean(),
  profile_id: z.string(),
});

export type CreateDepartmentRequest = z.infer<
  typeof CreateDepartmentRequestSchema
>;

export const CreateDepartmentResponseSchema = z.object({
  success: z.boolean(),
  departmentId: z.string(),
  message: z.string(),
});

export type CreateDepartmentResponse = z.infer<
  typeof CreateDepartmentResponseSchema
>;

// Update request
export const UpdateDepartmentRequestSchema = z.object({
  departmentId: z.string(),
  title: z.string(),
  description: z.string(),
  active: z.boolean(),
});

export type UpdateDepartmentRequest = z.infer<
  typeof UpdateDepartmentRequestSchema
>;

export const UpdateDepartmentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateDepartmentResponse = z.infer<
  typeof UpdateDepartmentResponseSchema
>;

// Duplicate request
export const DuplicateDepartmentRequestSchema = z.object({
  departmentId: z.string(),
});

export type DuplicateDepartmentRequest = z.infer<
  typeof DuplicateDepartmentRequestSchema
>;

export const DuplicateDepartmentResponseSchema = z.object({
  success: z.boolean(),
  departmentId: z.string(),
  message: z.string(),
});

export type DuplicateDepartmentResponse = z.infer<
  typeof DuplicateDepartmentResponseSchema
>;

// Delete request
export const DeleteDepartmentRequestSchema = z.object({
  departmentId: z.string(),
});

export type DeleteDepartmentRequest = z.infer<
  typeof DeleteDepartmentRequestSchema
>;

export const DeleteDepartmentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteDepartmentResponse = z.infer<
  typeof DeleteDepartmentResponseSchema
>;

// Remove profiles from department request
export const RemoveProfilesFromDepartmentRequestSchema = z.object({
  departmentId: z.string(),
  profileIds: z.array(z.string()),
});

export type RemoveProfilesFromDepartmentRequest = z.infer<
  typeof RemoveProfilesFromDepartmentRequestSchema
>;

export const RemoveProfilesFromDepartmentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type RemoveProfilesFromDepartmentResponse = z.infer<
  typeof RemoveProfilesFromDepartmentResponseSchema
>;
