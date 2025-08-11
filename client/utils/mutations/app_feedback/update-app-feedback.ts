// utils/mutations/app_feedback/update-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAppFeedback(ids: string[], data: Partial<typeof appFeedback.$inferInsert>) {
  try {
    return await db.update(appFeedback).set(data).where(inArray(appFeedback.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple app_feedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAppFeedback = createMockableAction('updateAppFeedback', _updateAppFeedback);
