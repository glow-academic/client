// utils/queries/agents/get-agents-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgentsByModel(modelId: string) {
  try {
    return await db.select().from(agents).where(eq(agents.modelId, modelId));
  } catch (error) {
    logError("Error fetching agents by model:", error);
    throw error;
  }
}
