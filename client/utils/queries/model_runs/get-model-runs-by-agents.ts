// utils/queries/model_runs/get-model-runs-by-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByAgents(agentIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.agentId, agentIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching model_runs by agents",
      subject: { entityType: "model_runs" },
      context: { function: "_getModelRunsByAgents", file: "utils/queries/model_runs/get-model-runs-by-agents.ts", foreignKey: "agentId", foreignIdsCount: agentIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByAgents = createMockableAction('getModelRunsByAgents', _getModelRunsByAgents);
