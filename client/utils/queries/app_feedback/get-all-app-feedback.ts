// utils/queries/app_feedback/get-all-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAppFeedback() {
  try {
    return await db.select().from(appFeedback);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all app_feedback",
      subject: { entityType: "app_feedback" },
      context: { function: "_getAllAppFeedback", file: "utils/queries/app_feedback/get-all-app-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAppFeedback = createMockableAction('getAllAppFeedback', _getAllAppFeedback);
