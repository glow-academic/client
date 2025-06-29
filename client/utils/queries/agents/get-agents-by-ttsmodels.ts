// utils/queries/agents/get-agents-by-tts-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgentsByTtsModels(ttsModelIds: string[]) {
  try {
    return await db.select().from(agents).where(inArray(agents.ttsModelId, ttsModelIds));
  } catch (error) {
    logError("Error fetching agents by ttsModels:", error);
    throw error;
  }
}
