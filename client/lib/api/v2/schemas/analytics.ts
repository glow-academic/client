/**
 * Shared Analytics V2 API Schemas
 * Re-exports common analytics types from base.ts for convenience
 */

import { z } from "zod";

/**
 * Materialized view refresh response (analytics-specific utility)
 */
export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  status: z.string(),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
