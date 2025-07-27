// utils/mutations/app_feedback/delete-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAppFeedback(ids: number[]) {
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
