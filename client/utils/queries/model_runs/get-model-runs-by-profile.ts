// utils/queries/model_runs/get-model-runs-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByProfile(profileId: string) {
  try {
    return await db.select().from(modelRuns).where(eq(modelRuns.profileId, profileId));
  } catch (error) {
    logError("Error fetching model_runs by profile:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByProfile = createMockableAction('getModelRunsByProfile', _getModelRunsByProfile);
