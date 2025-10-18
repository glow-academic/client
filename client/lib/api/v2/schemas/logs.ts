/**
 * Logs V2 API Schemas
 * Schema definitions for logs v2 endpoints (read-only)
 */

import { z } from "zod";

// ============================================================================
// JSONB FIELD SCHEMAS
// ============================================================================

export const ActorDataSchema = z
  .object({
    userId: z.string().nullable().optional(),
    profileId: z.string().nullable().optional(),
    profileName: z.string().nullable().optional(),
  })
  .nullable();

export const SubjectDataSchema = z
  .object({
    entityId: z.string().nullable().optional(),
    entityType: z.string().nullable().optional(),
  })
  .nullable();

export const MetricsDataSchema = z
  .object({
    size: z.number().nullable().optional(),
    count: z.number().nullable().optional(),
    durationMs: z.number().nullable().optional(),
  })
  .nullable();

export const ContextDataSchema = z
  .object({
    route: z.string().nullable().optional(),
    function: z.string().nullable().optional(),
    component: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
  })
  .nullable();

export const ErrorDataSchema = z
  .object({
    code: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    stack: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })
  .nullable();

export type ActorData = z.infer<typeof ActorDataSchema>;
export type SubjectData = z.infer<typeof SubjectDataSchema>;
export type MetricsData = z.infer<typeof MetricsDataSchema>;
export type ContextData = z.infer<typeof ContextDataSchema>;
export type ErrorData = z.infer<typeof ErrorDataSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const LogsListRequestSchema = z.object({
  profileId: z.string(),
});

export type LogsListRequest = z.infer<typeof LogsListRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Log item for list view
export const LogItemSchema = z.object({
  log_id: z.number(),
  event: z.string(),
  level: z.string(),
  message: z.string(),
  correlation_id: z.string(),
  actor: ActorDataSchema,
  subject: SubjectDataSchema,
  context: ContextDataSchema,
  error: ErrorDataSchema,
  created_at: z.string(),
  actor_name: z.string().nullable(),
});

export const LogsListResponseSchema = z.object({
  logs: z.array(LogItemSchema),
});

export type LogsListResponse = z.infer<typeof LogsListResponseSchema>;
export type LogItem = z.infer<typeof LogItemSchema>;

// ============================================================================
// CREATE LOG SCHEMAS
// ============================================================================

export const CorrelationDataSchema = z.object({
  correlationId: z.string().optional(),
  requestId: z.string().optional(),
  sessionId: z.string().optional(),
  attemptId: z.string().optional(),
  chatId: z.string().optional(),
});

export const CreateLogRequestSchema = z.object({
  event: z.string().default("legacy.message"),
  level: z.string().default("info"),
  message: z.string().default("Default Message"),
  correlation: CorrelationDataSchema.optional(),
  actor: z.record(z.any()).default({}),
  subject: z.record(z.any()).default({}),
  context: z.record(z.any()).default({}),
  error: z.record(z.any()).default({}),
});

export const CreateLogResponseSchema = z.object({
  success: z.boolean(),
  log_id: z.number().nullable().optional(),
});

export type CorrelationData = z.infer<typeof CorrelationDataSchema>;
export type CreateLogRequest = z.infer<typeof CreateLogRequestSchema>;
export type CreateLogResponse = z.infer<typeof CreateLogResponseSchema>;

// ============================================================================
// BULK DELETE SCHEMAS
// ============================================================================

export const BulkDeleteLogsRequestSchema = z.object({
  profileId: z.string(),
  ids: z.array(z.number()),
});

export const BulkDeleteLogsResponseSchema = z.object({
  success: z.boolean(),
  deleted_count: z.number(),
  message: z.string(),
});

export type BulkDeleteLogsRequest = z.infer<typeof BulkDeleteLogsRequestSchema>;
export type BulkDeleteLogsResponse = z.infer<
  typeof BulkDeleteLogsResponseSchema
>;
