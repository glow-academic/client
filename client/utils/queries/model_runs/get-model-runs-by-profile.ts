// utils/queries/model_runs/get-model-runs-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByProfile(profileId: string) {
  try {
    return await db.select().from(modelRuns).where(eq(modelRuns.profileId, profileId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching model_runs by profile",
      subject: { entityType: "model_runs" },
      context: { function: "_getModelRunsByProfile", file: "utils/queries/model_runs/get-model-runs-by-profile.ts", foreignKey: "profileId", foreignId: String(profileId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByProfile = createMockableAction('getModelRunsByProfile', _getModelRunsByProfile);
