/**
 * Health check schemas for system monitoring
 * Mirrors server-side health check schemas
 */

import { z } from "zod";

export const HealthCheckItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["healthy", "unhealthy", "warning", "n/a"]),
  response_time: z.number().nullable(),
  last_checked: z.string(),
  message: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  checks: z.array(HealthCheckItemSchema),
  timestamp: z.string(),
  overall_response_time: z.number(),
});

export type HealthCheckItem = z.infer<typeof HealthCheckItemSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

