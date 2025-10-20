/**
 * Leaderboard Bundle Schemas
 */

import { z } from "zod";

export const LeaderboardMetricSchema = z.object({
  hasData: z.boolean(),
  method: z.string(),
  currentValue: z.number(),
  keyField: z.string().nullish(),
  trendData: z.array(z.any()),
  dataPoints: z.array(z.any()),
  hover: z.record(z.string(), z.any()),
});

export const LeaderboardRowSchema = z.object({
  profileId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  metrics: z.object({
    totalAttempts: LeaderboardMetricSchema,
    highestScoreAvg: LeaderboardMetricSchema,
    messagesPerSession: LeaderboardMetricSchema,
    personaResponseSeconds: LeaderboardMetricSchema,
    timeSpentMinutes: LeaderboardMetricSchema,
    improvementRatePerDay: LeaderboardMetricSchema,
    perfectScoreCount: LeaderboardMetricSchema,
    quickestPassMinutes: LeaderboardMetricSchema,
  }),
});

export const LeaderboardBundleResponseSchema = z.object({
  data: z.array(LeaderboardRowSchema),
});

export type LeaderboardMetric = z.infer<typeof LeaderboardMetricSchema>;
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
export type LeaderboardBundleResponse = z.infer<
  typeof LeaderboardBundleResponseSchema
>;
