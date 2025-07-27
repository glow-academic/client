// utils/mutations/app_feedback/create-app-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAppFeedback(
  data: (typeof appFeedback.$inferInsert)[],
) {
  try {
    return await db.insert(appFeedback).values(data).returning();
  } catch (error) {
    logError("Error creating multiple app_feedback:", error);
    throw error;
  }
}
