/**
 * Agents V2 API Schemas
 * Schema definitions for agents v2 endpoints
 */

import { z } from "zod";

// ============================================================================
// CENTRALIZED MAPPING TYPES
// ============================================================================

export const ModelMappingSchema = z.record(z.string(), z.string()); // model_id -> name
export type ModelMapping = z.infer<typeof ModelMappingSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const AgentsListRequestSchema = z.object({
  profileId: z.string(),
});

export type AgentsListRequest = z.infer<typeof AgentsListRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Agent item for list view
export const AgentItemSchema = z.object({
  agent_id: z.string(),
  name: z.string(),
  description: z.string(),
  reasoning: z.string().nullable(),
  temperature: z.number(),
  model_id: z.string(),
  updated_at: z.string(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});

export const AgentsListResponseSchema = z.object({
  agents: z.array(AgentItemSchema),
  model_mapping: ModelMappingSchema,
});

export type AgentsListResponse = z.infer<typeof AgentsListResponseSchema>;
export type AgentItem = z.infer<typeof AgentItemSchema>;

// ============================================================================
// DETAIL SCHEMAS
// ============================================================================

export const AgentDetailRequestSchema = z.object({
  agentId: z.string(),
  profileId: z.string(),
});

export type AgentDetailRequest = z.infer<typeof AgentDetailRequestSchema>;

// Debug info item
export const DebugInfoItemSchema = z.object({
  created_at: z.string(),
  model_id: z.string(),
  content: z.string(),
});

export type DebugInfoItem = z.infer<typeof DebugInfoItemSchema>;

export const AgentDetailResponseSchema = z.object({
  // Basic fields
  name: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  temperature: z.number(),
  model_id: z.string(),
  reasoning: z.string().nullable(),

  // Metadata
  valid_model_ids: z.array(z.string()),
  reasoning_options: z.array(z.string()),
  temperature_lower: z.number(),
  temperature_upper: z.number(),

  // Debug info
  debug_info: z.array(DebugInfoItemSchema),

  // Mappings
  model_mapping: ModelMappingSchema,
});

export type AgentDetailResponse = z.infer<typeof AgentDetailResponseSchema>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Create request
export const CreateAgentRequestSchema = z.object({
  name: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  temperature: z.number(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
});

export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;

export const CreateAgentResponseSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  message: z.string(),
});

export type CreateAgentResponse = z.infer<typeof CreateAgentResponseSchema>;

// Update request
export const UpdateAgentRequestSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  temperature: z.number(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
});

export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequestSchema>;

export const UpdateAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateAgentResponse = z.infer<typeof UpdateAgentResponseSchema>;

// Duplicate request
export const DuplicateAgentRequestSchema = z.object({
  agentId: z.string(),
});

export type DuplicateAgentRequest = z.infer<typeof DuplicateAgentRequestSchema>;

export const DuplicateAgentResponseSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  message: z.string(),
});

export type DuplicateAgentResponse = z.infer<
  typeof DuplicateAgentResponseSchema
>;

// Delete request
export const DeleteAgentRequestSchema = z.object({
  agentId: z.string(),
});

export type DeleteAgentRequest = z.infer<typeof DeleteAgentRequestSchema>;

export const DeleteAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteAgentResponse = z.infer<typeof DeleteAgentResponseSchema>;
