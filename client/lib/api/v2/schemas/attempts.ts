/**
 * Attempts schemas for v2 API
 */

import { z } from "zod";

export const BulkArchiveAttemptsRequestSchema = z.object({
  attemptIds: z.array(z.string()),
  archived: z.boolean(),
});

export const BulkArchiveAttemptsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  count: z.number(),
});

export type BulkArchiveAttemptsRequest = z.infer<
  typeof BulkArchiveAttemptsRequestSchema
>;
export type BulkArchiveAttemptsResponse = z.infer<
  typeof BulkArchiveAttemptsResponseSchema
>;

