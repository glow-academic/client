// utils/queries/agents/get-agents-by-stt-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgentsBySttModels(sttModelIds: string[]) {
  try {
    return await db.select().from(agents).where(inArray(agents.sttModelId, sttModelIds));
  } catch (error) {
    logError("Error fetching agents by sttModels:", error);
    throw error;
  }
}
