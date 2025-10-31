/**
 * Agents V2 API Schemas
 * Schema definitions for agents v2 endpoints
 */

import { z } from "zod";
import {
  DepartmentMappingSchema,
  ModelMappingSchema,
  ReasoningMappingSchema,
} from "./base";

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
  role: z.string(),
  department_ids: z.array(z.string()).nullable(),
  updated_at: z.string(),
  can_edit: z.boolean(),
  can_duplicate: z.boolean(),
  can_delete: z.boolean(),
});

export const AgentsListResponseSchema = z.object({
  agents: z.array(AgentItemSchema),
  model_mapping: ModelMappingSchema,
  department_mapping: DepartmentMappingSchema,
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

export const AgentDetailDefaultRequestSchema = z.object({
  profileId: z.string(),
});

export type AgentDetailDefaultRequest = z.infer<
  typeof AgentDetailDefaultRequestSchema
>;

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
  prompt_id: z.string().nullable(),
  temperature: z.number(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
  active: z.boolean(),
  role: z.string(), // agent_role enum value

  // Prompt version history
  prompt_mapping: z.record(
    z.string(),
    z.object({
      system_prompt: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      department_ids: z.array(z.string()).nullable(),
    })
  ),

  // Department associations
  department_ids: z.array(z.string()),
  valid_department_ids: z.array(z.string()),
  department_mapping: DepartmentMappingSchema,

  // Metadata
  valid_model_ids: z.array(z.string()),
  reasoning_options: z.array(z.string()),
  temperature_lower: z.number(),
  temperature_upper: z.number(),

  // Debug info
  debug_info: z.array(DebugInfoItemSchema),

  // Mappings
  model_mapping: ModelMappingSchema,
  reasoning_mapping: ReasoningMappingSchema,
});

export type AgentDetailResponse = z.infer<typeof AgentDetailResponseSchema>;

// ============================================================================
// MUTATION SCHEMAS
// ============================================================================

// Create request
export const CreateAgentRequestSchema = z.object({
  name: z.string(),
  description: z.string(),
  prompt_id: z.string().nullable().optional(), // If provided, use existing prompt
  system_prompt: z.string(), // If prompt_id is None, create new prompt with this
  temperature: z.number(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
  active: z.boolean(),
  role: z.string(), // agent_role enum value
  department_ids: z.array(z.string()).nullable(), // None = cross-department (superadmin only)
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
  prompt_id: z.string().nullable().optional(), // If provided, use existing prompt
  system_prompt: z.string(), // If prompt_id is None, create new prompt with this
  temperature: z.number(),
  model_id: z.string(),
  reasoning: z.string().nullable(),
  active: z.boolean(),
  role: z.string(), // agent_role enum value
  department_ids: z.array(z.string()).nullable(), // None = cross-department (superadmin only)
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
