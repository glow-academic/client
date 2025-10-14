/**
 * Staff V2 API Schemas
 * Schema definitions for staff/profiles v2 endpoints
 */

import { z } from "zod";
import { CohortMappingSchema, DepartmentMappingSchema } from "./base";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const StaffFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(), // Current user's profile for permissions
});

export type StaffFilters = z.infer<typeof StaffFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Staff item (normalized - IDs only)
export const StaffItemSchema = z.object({
  profile_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  alias: z.string(),
  name: z.string(), // Combined first_name + last_name
  role: z.string(),
  email: z.string(), // alias + NEXT_PUBLIC_CAMPUS_EMAIL
  initials: z.string(), // Derived from first_name + last_name
  active: z.boolean(),
  lastActive: z.string().nullable(),
  cohort_ids: z.array(z.string()),
  requests_per_day: z.number().nullable(),
  default_profile: z.boolean(),
  requests_in_last_day: z.number(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});

export const StaffListResponseSchema = z.object({
  staff: z.array(StaffItemSchema),
  cohort_mapping: CohortMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;
export type StaffItem = z.infer<typeof StaffItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const StaffDetailRequestSchema = z.object({
  profileId: z.string(),
  currentProfileId: z.string(), // For permissions/validation
});

export type StaffDetailRequest = z.infer<typeof StaffDetailRequestSchema>;

export const StaffDetailResponseSchema = z.object({
  // Basic fields
  name: z.string(),
  email: z.string(),
  role: z.string(),
  requests_per_day: z.number().nullable(),
  active: z.boolean(),
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),
  cohort_ids: z.array(z.string()),

  // Metadata
  role_options: z.array(z.string()),

  // Top-level mappings
  cohort_mapping: CohortMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type StaffDetailResponse = z.infer<typeof StaffDetailResponseSchema>;

// Bulk detail request
export const StaffDetailBulkRequestSchema = z.object({
  profileIds: z.array(z.string()),
  currentProfileId: z.string(),
});

export type StaffDetailBulkRequest = z.infer<
  typeof StaffDetailBulkRequestSchema
>;

export const StaffDetailBulkResponseSchema = z.object({
  // Common editable fields across selected profiles
  role: z.string().nullable(), // null if mixed
  requests_per_day: z.number().nullable(), // null if mixed
  department_ids: z.array(z.string()),
  valid_department_ids: z.array(z.string()),

  // Metadata
  role_options: z.array(z.string()),

  // Top-level mappings
  department_mapping: DepartmentMappingSchema,
});

export type StaffDetailBulkResponse = z.infer<
  typeof StaffDetailBulkResponseSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Update request
export const UpdateStaffRequestSchema = z.object({
  profileId: z.string(),
  role: z.string(),
  requests_per_day: z.number().nullable(),
  department_id: z.string(),
  active: z.boolean(),
});

export type UpdateStaffRequest = z.infer<typeof UpdateStaffRequestSchema>;

export const UpdateStaffResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateStaffResponse = z.infer<typeof UpdateStaffResponseSchema>;

// Bulk update request
export const BulkUpdateStaffRequestSchema = z.object({
  profileIds: z.array(z.string()),
  role: z.string().optional(),
  requests_per_day: z.number().nullable().optional(),
  department_id: z.string().optional(),
  active: z.boolean().optional(),
});

export type BulkUpdateStaffRequest = z.infer<
  typeof BulkUpdateStaffRequestSchema
>;

export const BulkUpdateStaffResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type BulkUpdateStaffResponse = z.infer<
  typeof BulkUpdateStaffResponseSchema
>;

// Delete request
export const DeleteStaffRequestSchema = z.object({
  profileId: z.string(),
});

export type DeleteStaffRequest = z.infer<typeof DeleteStaffRequestSchema>;

export const DeleteStaffResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteStaffResponse = z.infer<typeof DeleteStaffResponseSchema>;

// Bulk delete request
export const BulkDeleteStaffRequestSchema = z.object({
  profileIds: z.array(z.string()),
});

export type BulkDeleteStaffRequest = z.infer<
  typeof BulkDeleteStaffRequestSchema
>;

export const BulkDeleteStaffResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type BulkDeleteStaffResponse = z.infer<
  typeof BulkDeleteStaffResponseSchema
>;
