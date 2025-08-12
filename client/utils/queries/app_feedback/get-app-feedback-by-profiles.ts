// utils/queries/app_feedback/get-app-feedback-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAppFeedbackByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(appFeedback).where(inArray(appFeedback.profileId, profileIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching app_feedback by profiles",
      subject: { entityType: "app_feedback" },
      context: { function: "_getAppFeedbackByProfiles", file: "utils/queries/app_feedback/get-app-feedback-by-profiles.ts", foreignKey: "profileId", foreignIdsCount: profileIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAppFeedbackByProfiles = createMockableAction('getAppFeedbackByProfiles', _getAppFeedbackByProfiles);
