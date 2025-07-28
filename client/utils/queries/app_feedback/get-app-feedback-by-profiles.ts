// utils/queries/app_feedback/get-app-feedback-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAppFeedbackByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(appFeedback).where(inArray(appFeedback.profileId, profileIds));
  } catch (error) {
    logError("Error fetching app_feedback by profiles:", error);
    throw error;
  }
}
