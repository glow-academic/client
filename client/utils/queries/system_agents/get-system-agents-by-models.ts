// utils/queries/system_agents/get-system-agents-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSystemAgentsByModels(modelIds: string[]) {
  try {
    return await db.select().from(systemAgents).where(inArray(systemAgents.modelId, modelIds));
  } catch (error) {
    logError("Error fetching system_agents by models:", error);
    throw error;
  }
}
