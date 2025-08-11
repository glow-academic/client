// utils/queries/model_runs/get-model-runs-by-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByAgent(agentId: string) {
  try {
    return await db.select().from(modelRuns).where(eq(modelRuns.agentId, agentId));
  } catch (error) {
    logError("Error fetching model_runs by agent:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByAgent = createMockableAction('getModelRunsByAgent', _getModelRunsByAgent);
