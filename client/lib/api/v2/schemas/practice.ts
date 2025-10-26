/**
 * Practice Overview Schemas
 */

import { z } from "zod";
import {
  ParameterItemMappingSchema,
  ParameterMappingSchema,
  PersonaMappingSchema,
  ScenarioMappingSchema,
  SimulationMappingSchema,
  StandardGroupsMappingSchema,
  StandardsMappingSchema,
} from "./base";
import { AttemptHistoryResponseSchema } from "./home";

/**
 * Practice filter schema - simplified to profile-only
 */
export const PracticeFiltersSchema = z.object({
  profileId: z.string(),
  departmentIds: z.array(z.string()).optional(),
});

export type PracticeFilters = z.infer<typeof PracticeFiltersSchema>;

export const PracticeSimulationItemSchema = z.object({
  viewMode: z.enum(["practice"]),
  id: z.string(),
  simulationTitle: z.string(),
  simulationDescription: z.string().nullable(),
  simulationName: z.string(),
  timeLimit: z.number().nullable().optional(),
  numSessions: z.number(),
  highestScore: z.number().nullable().optional(),
  standard_groups: z.record(z.string(), z.array(z.string())),
  rubric_id: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  hasPassed: z.boolean().nullable().optional(),
  passRate: z.number().nullable().optional(),
  status: z
    .enum(["not-started", "in-progress", "passed"])
    .nullable()
    .optional(),
  completionPct: z.number().nullable().optional(),
  passedCount: z.number().nullable().optional(),
  inProgressCount: z.number().nullable().optional(),
  notStartedCount: z.number().nullable().optional(),
  passPct: z.number().nullable().optional(),
  cohortName: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  lastActivityTs: z.string().nullable().optional(),
  hasActivity: z.boolean().nullable().optional(),
});

export const PracticeOverviewResponseSchema = z.object({
  mode: z.enum(["practice"]),
  hasData: z.boolean(),
  items: z.array(PracticeSimulationItemSchema),
  history: AttemptHistoryResponseSchema,
  standard_groups_mapping: StandardGroupsMappingSchema,
  standards_mapping: StandardsMappingSchema,
  simulation_mapping: SimulationMappingSchema,
  persona_mapping: PersonaMappingSchema,
  scenario_mapping: ScenarioMappingSchema,
  parameter_mapping: ParameterMappingSchema,
  parameter_item_mapping: ParameterItemMappingSchema,
});

export type PracticeSimulationItem = z.infer<
  typeof PracticeSimulationItemSchema
>;
export type PracticeOverviewResponse = z.infer<
  typeof PracticeOverviewResponseSchema
>;
