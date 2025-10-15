/**
 * Cohorts V2 API Schemas
 * Schema definitions for cohorts v2 endpoints
 */

import { z } from "zod";
import {
  DepartmentMappingSchema,
  ProfileMappingSchema,
  SimulationMappingSchema,
} from "./base";
import { ProfileListItemSchema } from "./profile";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CohortsFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type CohortsFilters = z.infer<typeof CohortsFiltersSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Cohort item (normalized - IDs only)
export const CohortItemSchema = z.object({
  cohort_id: z.string(),
  name: z.string(), // Maps to cohorts.title
  description: z.string().nullable(),
  active: z.boolean(),
  default_cohort: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_duplicate: z.boolean(),
  can_leave: z.boolean(),
  profile_ids: z.array(z.string()),
  simulation_ids: z.array(z.string()),
  num_members: z.number(),
});

export const CohortsListResponseSchema = z.object({
  cohorts: z.array(CohortItemSchema),
  profile_mapping: ProfileMappingSchema,
  simulation_mapping: SimulationMappingSchema,
});

export type CohortsListResponse = z.infer<typeof CohortsListResponseSchema>;
export type CohortItem = z.infer<typeof CohortItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const CohortDetailRequestSchema = z.object({
  cohortId: z.string(),
  profileId: z.string(),
});

export type CohortDetailRequest = z.infer<typeof CohortDetailRequestSchema>;

export const CohortDetailResponseSchema = z.object({
  // Basic fields
  title: z.string(), // cohorts.title
  description: z.string().nullable(),
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),
  active: z.boolean(),
  default_cohort: z.boolean(),

  // Relationships
  simulation_ids: z.array(z.string()),
  valid_simulation_ids: z.array(z.string()),
  profile_ids: z.array(z.string()),
  valid_profile_ids: z.array(z.string()),

  // Top-level mappings
  simulation_mapping: SimulationMappingSchema,
  profile_mapping: ProfileMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type CohortDetailResponse = z.infer<typeof CohortDetailResponseSchema>;

// Default detail request
export const CohortDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type CohortDetailDefaultRequest = z.infer<
  typeof CohortDetailDefaultRequestSchema
>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Create request
export const CreateCohortRequestSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),
  active: z.boolean(),
  default_cohort: z.boolean(),
  simulation_ids: z.array(z.string()),
  profile_ids: z.array(z.string()),
});

export type CreateCohortRequest = z.infer<typeof CreateCohortRequestSchema>;

export const CreateCohortResponseSchema = z.object({
  success: z.boolean(),
  cohortId: z.string(),
  message: z.string(),
});

export type CreateCohortResponse = z.infer<typeof CreateCohortResponseSchema>;

// Update request
export const UpdateCohortRequestSchema = z.object({
  cohortId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),
  active: z.boolean(),
  default_cohort: z.boolean(),
  simulation_ids: z.array(z.string()),
  profile_ids: z.array(z.string()),
});

export type UpdateCohortRequest = z.infer<typeof UpdateCohortRequestSchema>;

export const UpdateCohortResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateCohortResponse = z.infer<typeof UpdateCohortResponseSchema>;

// Duplicate request
export const DuplicateCohortRequestSchema = z.object({
  cohortId: z.string(),
});

export type DuplicateCohortRequest = z.infer<
  typeof DuplicateCohortRequestSchema
>;

export const DuplicateCohortResponseSchema = z.object({
  success: z.boolean(),
  cohortId: z.string(),
  message: z.string(),
});

export type DuplicateCohortResponse = z.infer<
  typeof DuplicateCohortResponseSchema
>;

// Delete request
export const DeleteCohortRequestSchema = z.object({
  cohortId: z.string(),
});

export type DeleteCohortRequest = z.infer<typeof DeleteCohortRequestSchema>;

export const DeleteCohortResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteCohortResponse = z.infer<typeof DeleteCohortResponseSchema>;

// Leave cohort request
export const LeaveCohortRequestSchema = z.object({
  cohortId: z.string(),
  profileId: z.string(),
});

export type LeaveCohortRequest = z.infer<typeof LeaveCohortRequestSchema>;

export const LeaveCohortResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type LeaveCohortResponse = z.infer<typeof LeaveCohortResponseSchema>;

// New profile for cohort (to create and add)
export const NewProfileForCohortSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  alias: z.string(),
  role: z.enum(["ta", "instructional"]),
});

export type NewProfileForCohort = z.infer<typeof NewProfileForCohortSchema>;

// Add profiles to cohort request (supports both existing and new)
export const AddProfilesToCohortRequestSchema = z.object({
  cohortId: z.string(),
  departmentIds: z.array(z.string()),
  existingProfileIds: z.array(z.string()).optional(),
  newProfiles: z.array(NewProfileForCohortSchema).optional(),
});

export type AddProfilesToCohortRequest = z.infer<
  typeof AddProfilesToCohortRequestSchema
>;

export const AddProfilesToCohortResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type AddProfilesToCohortResponse = z.infer<
  typeof AddProfilesToCohortResponseSchema
>;

// Remove profiles from cohort request
export const RemoveProfilesFromCohortRequestSchema = z.object({
  cohortId: z.string(),
  profileIds: z.array(z.string()),
});

export type RemoveProfilesFromCohortRequest = z.infer<
  typeof RemoveProfilesFromCohortRequestSchema
>;

export const RemoveProfilesFromCohortResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type RemoveProfilesFromCohortResponse = z.infer<
  typeof RemoveProfilesFromCohortResponseSchema
>;

// ============================================================================
// COHORT DETAIL WITH PROFILES (unified endpoint)
// ============================================================================

export const CohortDetailWithProfilesRequestSchema = z.object({
  cohortId: z.string(),
  departmentIds: z.array(z.string()),
  currentProfileId: z.string(),
});

export type CohortDetailWithProfilesRequest = z.infer<
  typeof CohortDetailWithProfilesRequestSchema
>;

export const CohortDetailWithProfilesResponseSchema = z.object({
  // Cohort info
  cohort_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  active: z.boolean(),

  // Profile IDs already in cohort
  current_profile_ids: z.array(z.string()),

  // Available profiles (filtered: instructional/ta, not in cohort, not default)
  available_profiles: z.array(ProfileListItemSchema),

  // Mappings
  department_mapping: DepartmentMappingSchema,
  cohort_mapping: z.record(
    z.string(),
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
});

export type CohortDetailWithProfilesResponse = z.infer<
  typeof CohortDetailWithProfilesResponseSchema
>;
