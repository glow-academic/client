// utils/mutations/app_feedback/update-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAppFeedback(
  ids: number[],
  data: Partial<typeof appFeedback.$inferInsert>,
) {
  try {
    return await db
      .update(appFeedback)
      .set(data)
      .where(inArray(appFeedback.id, ids))
      .returning();
  } catch (error) {
    logError("Error updating multiple app_feedback:", error);
    throw error;
  }
}
