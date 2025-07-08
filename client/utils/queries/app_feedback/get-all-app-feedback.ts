// utils/queries/app_feedback/get-all-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllAppFeedback() {
  try {
    return await db.select().from(appFeedback);
  } catch (error) {
    logError("Error fetching all app_feedback:", error);
    throw error;
  }
}
