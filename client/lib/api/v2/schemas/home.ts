/**
 * Home Overview Schemas
 */

import { z } from "zod";
import {
  SimulationMappingSchema,
  StandardGroupsMappingSchema,
  StandardsMappingSchema,
} from "./base";

/**
 * Home filter schema - always shows general simulations (no roles/simulationFilters)
 */
export const HomeFiltersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  cohortIds: z.array(z.string()).optional(),
  profileId: z.string().nullable().optional(),
  departmentIds: z.array(z.string()).optional(),
});

export type HomeFilters = z.infer<typeof HomeFiltersSchema>;

export const HomeSimulationItemSchema = z.object({
  viewMode: z.enum(["ta", "instructional"]),
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
  cohortName: z.string().nullable().optional(),
  cohortNames: z.string().nullable().optional(),
  orderIndex: z.number().nullable().optional(),
  status: z.enum(["not-started", "in-progress", "passed"]),
  completionPct: z.number(),
  passedCount: z.number().nullable().optional(),
  inProgressCount: z.number().nullable().optional(),
  notStartedCount: z.number().nullable().optional(),
  passPct: z.number().nullable().optional(),
});

export const AttemptHistoryRowSchema = z.object({
  attemptId: z.string(),
  date: z.string(),
  profileId: z.string(),
  profileName: z.string(),
  simulationName: z.string(),
  numScenarios: z.number().nullable(),
  numScenariosCompleted: z.number(),
  infiniteMode: z.boolean(),
  timeLimit: z.number().nullable(), // simulation time limit in seconds (from server)
  personaNames: z.array(z.string()),
  personaColors: z.array(z.string()),
  score: z.number().nullable(),
  simulation_id: z.string(),
  department_id: z.string(),
  scenario_ids: z.array(z.string()),
  scenario_titles: z.array(z.string()),
  isArchived: z.boolean(),
  showView: z.boolean(),
  showContinue: z.boolean(),
  practiceSimulation: z.boolean(),
  passPct: z.number().nullable(),
  cohortNames: z.array(z.string()),
});

export const AttemptHistoryResponseSchema = z.array(AttemptHistoryRowSchema);

export const HomeOverviewResponseSchema = z.object({
  mode: z.enum(["ta", "instructional", "empty"]),
  hasData: z.boolean(),
  items: z.array(HomeSimulationItemSchema),
  history: AttemptHistoryResponseSchema,
  standard_groups_mapping: StandardGroupsMappingSchema,
  standards_mapping: StandardsMappingSchema,
  simulation_mapping: SimulationMappingSchema,
});

export type HomeSimulationItem = z.infer<typeof HomeSimulationItemSchema>;
export type AttemptHistoryRow = z.infer<typeof AttemptHistoryRowSchema>;
export type AttemptHistoryResponse = z.infer<
  typeof AttemptHistoryResponseSchema
>;
export type HomeOverviewResponse = z.infer<typeof HomeOverviewResponseSchema>;
