// utils/queries/model_runs/get-model-runs-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.profileId, profileIds));
  } catch (error) {
    logError("Error fetching model_runs by profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByProfiles = createMockableAction('getModelRunsByProfiles', _getModelRunsByProfiles);
