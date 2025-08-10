// utils/queries/model_runs/get-model-runs-by-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getModelRunsByAgent(agentId: string) {
  try {
    return await db.select().from(modelRuns).where(eq(modelRuns.agentId, agentId));
  } catch (error) {
    logError("Error fetching model_runs by agent:", error);
    throw error;
  }
}
