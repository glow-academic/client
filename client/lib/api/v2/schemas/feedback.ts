/**
 * Feedback V2 API Schemas
 * Schema definitions for feedback v2 endpoints (read-only)
 */

import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const FeedbackListRequestSchema = z.object({
  profileId: z.string(),
});

export type FeedbackListRequest = z.infer<typeof FeedbackListRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Feedback item for list view
export const FeedbackItemSchema = z.object({
  feedback_id: z.number(),
  type: z.string(), // 'feature', 'bug', 'question', 'other'
  message: z.string(),
  created_at: z.string(),
  author_name: z.string(),
  author_alias: z.string(),
  author_profile_id: z.string(),
});

export const FeedbackListResponseSchema = z.object({
  feedback: z.array(FeedbackItemSchema),
});

export type FeedbackListResponse = z.infer<typeof FeedbackListResponseSchema>;
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;
