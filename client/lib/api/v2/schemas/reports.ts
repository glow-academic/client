/**
 * Reports Bundle Schemas
 */

import { z } from "zod";
import { ScenarioMappingSchema, SimulationMappingSchema } from "./base";

export const ProfileMetricsSchema = z.object({
  averageScore: z.any(), // Complex nested structure
  completionPercentage: z.any(),
  firstAttemptPassRate: z.any(),
  highestScore: z.any(),
  messagesPerSession: z.any(),
  personaResponseTimes: z.any(),
  sessionEfficiency: z.any(),
  stagnationRate: z.any(),
  timeSpent: z.any(),
  totalAttempts: z.any(),
});

export const ProfileDataEnhancedSchema = z.object({
  profileId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  alias: z.string(),
  role: z.string(),
  metrics: ProfileMetricsSchema,
});

export const ReportsBundleResponseSchema = z.object({
  data: z.array(ProfileDataEnhancedSchema),
  scenario_mapping: ScenarioMappingSchema,
  simulation_mapping: SimulationMappingSchema,
});

export type ProfileDataEnhanced = z.infer<typeof ProfileDataEnhancedSchema>;
export type ProfileMetrics = z.infer<typeof ProfileMetricsSchema>;
export type ReportsBundleResponse = z.infer<typeof ReportsBundleResponseSchema>;

