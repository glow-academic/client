// utils/mutations/app_feedback/update-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAppFeedback(ids: number[], data: Partial<typeof appFeedback.$inferInsert>) {
  try {
    return await db.update(appFeedback).set(data).where(inArray(appFeedback.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple app_feedback",
      subject: { entityType: "app_feedback" },
      context: { function: "_updateAppFeedback", file: "utils/mutations/app_feedback/update-app-feedback.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAppFeedback = createMockableAction('updateAppFeedback', _updateAppFeedback);
