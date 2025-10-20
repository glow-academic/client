/**
 * Pricing Analytics Schemas
 */

import { z } from "zod";

export const DebugInfoItemSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  content: z.string(),
});

export const ModelRunItemSchema = z.object({
  model_run_id: z.string(),
  created_at: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  model_id: z.string().nullable(),
  profile_id: z.string().nullable(),
  agent_id: z.string().nullable(),
  persona_id: z.string().nullable(),
  debug_info: z.array(DebugInfoItemSchema),
});

export const ModelMappingWithPricingSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_ppm: z.number(),
  output_ppm: z.number(),
});

export const PricingAnalyticsResponseSchema = z.object({
  model_runs: z.array(ModelRunItemSchema),
  model_mapping: z.record(z.string(), ModelMappingWithPricingSchema),
  profile_mapping: z.record(z.string(), z.string()),
  agent_mapping: z.record(z.string(), z.string()),
  persona_mapping: z.record(z.string(), z.string()),
});

export type DebugInfoItem = z.infer<typeof DebugInfoItemSchema>;
export type ModelRunItem = z.infer<typeof ModelRunItemSchema>;
export type ModelMappingWithPricing = z.infer<
  typeof ModelMappingWithPricingSchema
>;
export type PricingAnalyticsResponse = z.infer<
  typeof PricingAnalyticsResponseSchema
>;

