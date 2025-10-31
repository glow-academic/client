/**
 * Providers V2 API Schemas
 * Schema definitions for providers and models v2 endpoints
 */

import { z } from "zod";
import { ProviderMappingSchema } from "./base";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const ProvidersFiltersSchema = z.object({
  profileId: z.string(),
});

export type ProvidersFilters = z.infer<typeof ProvidersFiltersSchema>;

// Note: Providers are global (not department-specific), so no department filter

// ============================================================================
// RESPONSE SCHEMAS - HIERARCHICAL LIST
// ============================================================================

// Model item nested in provider (denormalized for UI)
export const ModelItemSchema = z.object({
  model_id: z.string(),
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  custom_model: z.boolean(),
  updated_at: z.string(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});

export type ModelItem = z.infer<typeof ModelItemSchema>;

// Provider with nested models
export const ProviderWithModelsSchema = z.object({
  provider_id: z.string(),
  name: z.string(),
  description: z.string(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  models: z.array(ModelItemSchema),
});

export type ProviderWithModels = z.infer<typeof ProviderWithModelsSchema>;

export const ProvidersListResponseSchema = z.object({
  providers: z.array(ProviderWithModelsSchema),
});

export type ProvidersListResponse = z.infer<typeof ProvidersListResponseSchema>;

// ============================================================================
// PROVIDER DETAIL SCHEMAS
// ============================================================================

export const ProviderDetailRequestSchema = z.object({
  providerId: z.string(),
  profileId: z.string(),
});

export type ProviderDetailRequest = z.infer<typeof ProviderDetailRequestSchema>;

export const ProviderDetailResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  api_key: z.string(), // Encrypted - for display only
  base_url: z.string().nullable(),
});

export type ProviderDetailResponse = z.infer<
  typeof ProviderDetailResponseSchema
>;

// ============================================================================
// MODEL DETAIL SCHEMAS
// ============================================================================

export const ModelDetailRequestSchema = z.object({
  modelId: z.string(),
  providerId: z.string(),
  profileId: z.string(),
});

export type ModelDetailRequest = z.infer<typeof ModelDetailRequestSchema>;

export const ModelDetailResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  custom_model: z.boolean(),
  image_model: z.boolean(),
  input_ppm: z.number(),
  output_ppm: z.number(),
  provider_id: z.string(),

  // Metadata
  valid_provider_ids: z.array(z.string()),

  // Top-level mappings
  provider_mapping: ProviderMappingSchema,
});

export type ModelDetailResponse = z.infer<typeof ModelDetailResponseSchema>;

// ============================================================================
// PROVIDER MUTATION SCHEMAS
// ============================================================================

// Create provider
export const CreateProviderRequestSchema = z.object({
  name: z.string(),
  description: z.string(),
  api_key: z.string(), // Will be encrypted server-side
  base_url: z.string().nullable(),
});

export type CreateProviderRequest = z.infer<typeof CreateProviderRequestSchema>;

export const CreateProviderResponseSchema = z.object({
  success: z.boolean(),
  providerId: z.string(),
  message: z.string(),
});

export type CreateProviderResponse = z.infer<
  typeof CreateProviderResponseSchema
>;

// Update provider
export const UpdateProviderRequestSchema = z.object({
  providerId: z.string(),
  name: z.string(),
  description: z.string(),
  api_key: z.string().optional(), // Optional - only update if provided
  base_url: z.string().nullable(),
});

export type UpdateProviderRequest = z.infer<typeof UpdateProviderRequestSchema>;

export const UpdateProviderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateProviderResponse = z.infer<
  typeof UpdateProviderResponseSchema
>;

// Delete provider
export const DeleteProviderRequestSchema = z.object({
  providerId: z.string(),
});

export type DeleteProviderRequest = z.infer<typeof DeleteProviderRequestSchema>;

export const DeleteProviderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteProviderResponse = z.infer<
  typeof DeleteProviderResponseSchema
>;

// Duplicate provider
export const DuplicateProviderRequestSchema = z.object({
  providerId: z.string(),
});

export type DuplicateProviderRequest = z.infer<
  typeof DuplicateProviderRequestSchema
>;

export const DuplicateProviderResponseSchema = z.object({
  success: z.boolean(),
  providerId: z.string(),
  message: z.string(),
});

export type DuplicateProviderResponse = z.infer<
  typeof DuplicateProviderResponseSchema
>;

// ============================================================================
// MODEL MUTATION SCHEMAS
// ============================================================================

// Create model
export const CreateModelRequestSchema = z.object({
  provider_id: z.string(),
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  custom_model: z.boolean(),
  input_ppm: z.number(),
  output_ppm: z.number(),
});

export type CreateModelRequest = z.infer<typeof CreateModelRequestSchema>;

export const CreateModelResponseSchema = z.object({
  success: z.boolean(),
  modelId: z.string(),
  message: z.string(),
});

export type CreateModelResponse = z.infer<typeof CreateModelResponseSchema>;

// Update model
export const UpdateModelRequestSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  custom_model: z.boolean(),
  input_ppm: z.number(),
  output_ppm: z.number(),
});

export type UpdateModelRequest = z.infer<typeof UpdateModelRequestSchema>;

export const UpdateModelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateModelResponse = z.infer<typeof UpdateModelResponseSchema>;

// Delete model
export const DeleteModelRequestSchema = z.object({
  modelId: z.string(),
});

export type DeleteModelRequest = z.infer<typeof DeleteModelRequestSchema>;

export const DeleteModelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteModelResponse = z.infer<typeof DeleteModelResponseSchema>;

// Duplicate model
export const DuplicateModelRequestSchema = z.object({
  modelId: z.string(),
});

export type DuplicateModelRequest = z.infer<typeof DuplicateModelRequestSchema>;

export const DuplicateModelResponseSchema = z.object({
  success: z.boolean(),
  modelId: z.string(),
  message: z.string(),
});

export type DuplicateModelResponse = z.infer<
  typeof DuplicateModelResponseSchema
>;

// ============================================================================
// DECRYPT API KEY SCHEMAS
// ============================================================================

export const DecryptProviderKeyRequestSchema = z.object({
  providerId: z.string(),
  profileId: z.string(),
});

export type DecryptProviderKeyRequest = z.infer<
  typeof DecryptProviderKeyRequestSchema
>;

export const DecryptProviderKeyResponseSchema = z.object({
  api_key: z.string(),
});

export type DecryptProviderKeyResponse = z.infer<
  typeof DecryptProviderKeyResponseSchema
>;
