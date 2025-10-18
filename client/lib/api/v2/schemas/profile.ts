/**
 * Profile V2 API Schemas - unified auth and staff schemas
 */

import { z } from "zod";
import { CohortMappingSchema, DepartmentMappingSchema } from "./base";

// ============================================================================
// PROFILE ITEM (BASE)
// ============================================================================

export const ProfileItemSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  alias: z.string(),
  role: z.enum(["superadmin", "admin", "instructional", "ta", "guest"]),
  active: z.boolean(),
  viewedIntro: z.boolean(),
  viewedChat: z.boolean(),
  defaultProfile: z.boolean(),
  reqPerDay: z.number().nullable(),
  lastLogin: z.string(),
  lastActive: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  primaryDepartmentId: z.string().nullable(),
});

export type ProfileItem = z.infer<typeof ProfileItemSchema>;

// ============================================================================
// PROFILE LIST (from staff)
// ============================================================================

export const ProfileFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(), // Current user's profile for permissions
});

export type ProfileFilters = z.infer<typeof ProfileFiltersSchema>;

// Profile item for list (with additional staff fields)
export const ProfileListItemSchema = z.object({
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

export const ProfileListResponseSchema = z.object({
  staff: z.array(ProfileListItemSchema),
  cohort_mapping: CohortMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type ProfileListResponse = z.infer<typeof ProfileListResponseSchema>;
export type ProfileListItem = z.infer<typeof ProfileListItemSchema>;

// ============================================================================
// PROFILE DETAIL (from staff)
// ============================================================================

export const ProfileDetailRequestSchema = z.object({
  profileId: z.string(),
  currentProfileId: z.string(), // For permissions/validation
});

export type ProfileDetailRequest = z.infer<typeof ProfileDetailRequestSchema>;

export const ProfileDetailResponseSchema = z.object({
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

export type ProfileDetailResponse = z.infer<typeof ProfileDetailResponseSchema>;

// Bulk detail request
export const ProfileDetailBulkRequestSchema = z.object({
  profileIds: z.array(z.string()),
  currentProfileId: z.string(),
});

export type ProfileDetailBulkRequest = z.infer<
  typeof ProfileDetailBulkRequestSchema
>;

export const ProfileDetailBulkResponseSchema = z.object({
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

export type ProfileDetailBulkResponse = z.infer<
  typeof ProfileDetailBulkResponseSchema
>;

// ============================================================================
// PROFILE UPDATE (from staff)
// ============================================================================

export const UpdateProfileRequestSchema = z.object({
  profileId: z.string(),
  role: z.string(),
  requests_per_day: z.number().nullable(),
  department_id: z.string(),
  active: z.boolean(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UpdateProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;

// Bulk update request
export const BulkUpdateProfileRequestSchema = z.object({
  profileIds: z.array(z.string()),
  role: z.string().optional(),
  requests_per_day: z.number().nullable().optional(),
  department_id: z.string().optional(),
  active: z.boolean().optional(),
});

export type BulkUpdateProfileRequest = z.infer<
  typeof BulkUpdateProfileRequestSchema
>;

export const BulkUpdateProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type BulkUpdateProfileResponse = z.infer<
  typeof BulkUpdateProfileResponseSchema
>;

// ============================================================================
// PROFILE DELETE (from staff)
// ============================================================================

export const DeleteProfileRequestSchema = z.object({
  profileId: z.string(),
});

export type DeleteProfileRequest = z.infer<typeof DeleteProfileRequestSchema>;

export const DeleteProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteProfileResponse = z.infer<typeof DeleteProfileResponseSchema>;

// Bulk delete request
export const BulkDeleteProfileRequestSchema = z.object({
  profileIds: z.array(z.string()),
});

export type BulkDeleteProfileRequest = z.infer<
  typeof BulkDeleteProfileRequestSchema
>;

export const BulkDeleteProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type BulkDeleteProfileResponse = z.infer<
  typeof BulkDeleteProfileResponseSchema
>;

// ============================================================================
// PROFILE CREATE (from staff)
// ============================================================================

export const CreateProfileRequestSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  alias: z.string(),
  role: z.enum(["superadmin", "admin", "instructional", "ta", "guest"]),
  department_id: z.string().optional(),
});

export type CreateProfileRequest = z.infer<typeof CreateProfileRequestSchema>;

export const CreateProfileResponseSchema = z.object({
  success: z.boolean(),
  profileId: z.string(),
  message: z.string(),
});

export type CreateProfileResponse = z.infer<typeof CreateProfileResponseSchema>;

// Bulk create request
export const BulkCreateProfileRequestSchema = z.object({
  profiles: z.array(CreateProfileRequestSchema),
});

export type BulkCreateProfileRequest = z.infer<
  typeof BulkCreateProfileRequestSchema
>;

export const BulkCreateProfileResponseSchema = z.object({
  success: z.boolean(),
  profileIds: z.array(z.string()),
  message: z.string(),
});

export type BulkCreateProfileResponse = z.infer<
  typeof BulkCreateProfileResponseSchema
>;

// ============================================================================
// SIMPLE PROFILE OPERATIONS (from auth)
// ============================================================================

export const ProfileSimpleDetailRequestSchema = z.object({
  profileId: z.string(),
});

export type ProfileSimpleDetailRequest = z.infer<
  typeof ProfileSimpleDetailRequestSchema
>;

export const ProfileSimpleDetailResponseSchema = z.object({
  profile: ProfileItemSchema,
});

export type ProfileSimpleDetailResponse = z.infer<
  typeof ProfileSimpleDetailResponseSchema
>;

export const UpdateProfileSimpleRequestSchema = z.object({
  profileId: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().optional(),
  active: z.boolean().optional(),
  viewedIntro: z.boolean().optional(),
  viewedChat: z.boolean().optional(),
  reqPerDay: z.number().nullable().optional(),
});

export type UpdateProfileSimpleRequest = z.infer<
  typeof UpdateProfileSimpleRequestSchema
>;

export const UpdateProfileSimpleResponseSchema = z.object({
  profile: ProfileItemSchema,
});

export type UpdateProfileSimpleResponse = z.infer<
  typeof UpdateProfileSimpleResponseSchema
>;

// ============================================================================
// PROFILE BY ALIAS OPERATIONS
// ============================================================================

export const ProfileByAliasRequestSchema = z.object({
  alias: z.string(),
});

export type ProfileByAliasRequest = z.infer<typeof ProfileByAliasRequestSchema>;

// ============================================================================
// USER PROFILES OPERATIONS (Junction Table)
// ============================================================================

export const UserProfileItemSchema = z.object({
  userId: z.number(),
  profileId: z.string(),
  isPrimary: z.boolean(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserProfileItem = z.infer<typeof UserProfileItemSchema>;

export const ListUserProfilesByUserRequestSchema = z.object({
  userId: z.number(),
});

export type ListUserProfilesByUserRequest = z.infer<
  typeof ListUserProfilesByUserRequestSchema
>;

export const ListUserProfilesByProfileRequestSchema = z.object({
  profileId: z.string(),
});

export type ListUserProfilesByProfileRequest = z.infer<
  typeof ListUserProfilesByProfileRequestSchema
>;

export const UserProfilesListResponseSchema = z.object({
  userProfiles: z.array(UserProfileItemSchema),
});

export type UserProfilesListResponse = z.infer<
  typeof UserProfilesListResponseSchema
>;

export const CreateUserProfileRequestSchema = z.object({
  userId: z.number(),
  profileId: z.string(),
  isPrimary: z.boolean(),
  active: z.boolean(),
});

export type CreateUserProfileRequest = z.infer<
  typeof CreateUserProfileRequestSchema
>;

export const CreateUserProfileResponseSchema = z.object({
  userProfile: UserProfileItemSchema,
});

export type CreateUserProfileResponse = z.infer<
  typeof CreateUserProfileResponseSchema
>;

// ============================================================================
// EMULATION OPERATIONS (from auth)
// ============================================================================

export const AuthorizeEmulationRequestSchema = z.object({
  requesterProfileId: z.string(),
  targetProfileId: z.string(),
  departmentIds: z.array(z.string()),
});

export type AuthorizeEmulationRequest = z.infer<
  typeof AuthorizeEmulationRequestSchema
>;

export const AuthorizeEmulationResponseSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().nullable().optional(),
});

export type AuthorizeEmulationResponse = z.infer<
  typeof AuthorizeEmulationResponseSchema
>;

// ============================================================================
// TOUR COMPLETION OPERATIONS (from auth)
// ============================================================================

export const MarkIntroCompleteRequestSchema = z.object({
  profileId: z.string(),
});

export type MarkIntroCompleteRequest = z.infer<
  typeof MarkIntroCompleteRequestSchema
>;

export const MarkChatCompleteRequestSchema = z.object({
  profileId: z.string(),
});

export type MarkChatCompleteRequest = z.infer<
  typeof MarkChatCompleteRequestSchema
>;

export const MarkTourStepResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type MarkTourStepResponse = z.infer<typeof MarkTourStepResponseSchema>;

// ============================================================================
// PROFILE CONTEXT (from auth)
// ============================================================================

export const ProfileContextRequestSchema = z.object({
  effectiveProfileId: z.string(),
  pathname: z.string(),
});

export type ProfileContextRequest = z.infer<typeof ProfileContextRequestSchema>;

// Note: ProfileContextResponse types are defined in profile-context.tsx
// to avoid circular dependencies
