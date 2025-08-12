// utils/queries/app_feedback/get-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAppFeedback(id: number) {
  try {
    const result = await db.select().from(appFeedback).where(eq(appFeedback.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching appFeedback",
      subject: { entityType: "app_feedback", entityId: String(id) },
      context: { function: "_getAppFeedback", file: "utils/queries/app_feedback/get-app-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAppFeedback = createMockableAction('getAppFeedback', _getAppFeedback);
