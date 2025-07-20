// utils/queries/system_agents/get-system-agents-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { systemAgents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSystemAgentsByModel(modelId: string) {
  try {
    return await db.select().from(systemAgents).where(eq(systemAgents.modelId, modelId));
  } catch (error) {
    logError("Error fetching system_agents by model:", error);
    throw error;
  }
}
