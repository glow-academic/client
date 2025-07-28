// utils/queries/app_feedback/get-app-feedback-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAppFeedbackByProfile(profileId: string) {
  try {
    return await db.select().from(appFeedback).where(eq(appFeedback.profileId, profileId));
  } catch (error) {
    logError("Error fetching app_feedback by profile:", error);
    throw error;
  }
}
