// utils/queries/model_runs/get-model-runs-by-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getModelRunsByAgents(agentIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.agentId, agentIds));
  } catch (error) {
    logError("Error fetching model_runs by agents:", error);
    throw error;
  }
}
