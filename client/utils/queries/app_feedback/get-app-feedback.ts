// utils/queries/app_feedback/get-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAppFeedback(id: number) {
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
