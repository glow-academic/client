// utils/queries/agents/get-agents-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgentsByModels(modelIds: string[]) {
  try {
    return await db
      .select()
      .from(agents)
      .where(inArray(agents.modelId, modelIds));
  } catch (error) {
    logError("Error fetching agents by models:", error);
    throw error;
  }
}
