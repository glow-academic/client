// utils/mutations/app_feedback/delete-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAppFeedback(ids: number[]) {
  try {
    return await db.delete(appFeedback).where(inArray(appFeedback.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple app_feedback",
      subject: { entityType: "app_feedback" },
      context: { function: "_deleteAppFeedback", file: "utils/mutations/app_feedback/delete-app-feedback.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAppFeedback = createMockableAction('deleteAppFeedback', _deleteAppFeedback);
