/**
 * Departments V2 API Schemas
 * Schema definitions for departments v2 endpoints with agent role assignments
 */

import { z } from "zod";
import { AgentMappingSchema } from "./base";

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
  default_department: z.boolean(),
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

// Agent roles object (8 required roles)
export const AgentRolesSchema = z.object({
  title: z.string(),
  scenario: z.string(),
  classify: z.string(),
  assistant: z.string(),
  grade: z.string(),
  input_guardrail: z.string(),
  output_guardrail: z.string(),
  hint: z.string(),
});

export type AgentRoles = z.infer<typeof AgentRolesSchema>;

export const DepartmentDetailResponseSchema = z.object({
  // Basic fields
  title: z.string(),
  description: z.string(),
  active: z.boolean(),
  default_department: z.boolean(),

  // Agent role assignments (8 required roles)
  agent_roles: AgentRolesSchema,

  // Valid agents for selection
  valid_agent_ids: z.array(z.string()),
  valid_agent_ids_by_role: z.record(z.string(), z.array(z.string())),

  // Top-level mappings
  agent_mapping: AgentMappingSchema,

  // Permissions
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),

  // Usage/Stats
  in_use: z.boolean(),
  staff_count: z.number(),
  total_price_spent: z.number(),
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
  default_department: z.boolean(),
  agent_roles: AgentRolesSchema,
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
  default_department: z.boolean(),
  agent_roles: AgentRolesSchema,
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
