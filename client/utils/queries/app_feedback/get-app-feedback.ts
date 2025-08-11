// utils/queries/app_feedback/get-app-feedback.ts
"use server";
import { createMockableAction } from "@/lib/testing/create-mockable-action";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { eq } from "drizzle-orm";

// Original logic is now a "private" function
async function _getAppFeedback(id: number) {
  try {
    const result = await db
      .select()
      .from(appFeedback)
      .where(eq(appFeedback.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching appFeedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAppFeedback = createMockableAction(
  "getAppFeedback",
  _getAppFeedback
);
