// utils/mutations/app_feedback/delete-app-feedback.ts
"use server";
import { createMockableAction } from "@/lib/testing/create-mockable-action";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { inArray } from "drizzle-orm";

// Original logic is now a "private" function
async function _deleteAppFeedback(ids: number[]) {
  try {
    return await db
      .delete(appFeedback)
      .where(inArray(appFeedback.id, ids))
      .returning();
  } catch (error) {
    logError("Error deleting multiple app_feedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAppFeedback = createMockableAction(
  "deleteAppFeedback",
  _deleteAppFeedback
);
