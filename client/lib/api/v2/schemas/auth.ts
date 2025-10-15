/**
 * Auth v2 API schemas (matches server-side schemas)
 */

import { z } from "zod";

// ============================================================================
// PROFILE CONTEXT SCHEMAS
// ============================================================================

export const LayoutContextRequestSchema = z.object({
  userId: z.string(),
  effectiveProfileId: z.string(),
  pathname: z.string(),
});

export type LayoutContextRequest = z.infer<typeof LayoutContextRequestSchema>;

// Response types are defined in profile-context.tsx to avoid circular dependencies
