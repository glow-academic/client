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

export const UpdateChatCreatedAtRequestSchema = z.object({
  chatId: z.string(),
  createdAt: z.string(),
});

export const UpdateChatCompletedAtRequestSchema = z.object({
  chatId: z.string(),
  completedAt: z.string(),
});

export const UpdateChatTimestampResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateChatCreatedAtRequest = z.infer<
  typeof UpdateChatCreatedAtRequestSchema
>;
export type UpdateChatCompletedAtRequest = z.infer<
  typeof UpdateChatCompletedAtRequestSchema
>;
export type UpdateChatTimestampResponse = z.infer<
  typeof UpdateChatTimestampResponseSchema
>;
