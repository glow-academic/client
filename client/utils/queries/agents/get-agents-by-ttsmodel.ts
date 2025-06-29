// utils/queries/agents/get-agents-by-tts-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgentsByTtsModel(ttsModelId: string) {
  try {
    return await db.select().from(agents).where(eq(agents.ttsModelId, ttsModelId));
  } catch (error) {
    logError("Error fetching agents by ttsModel:", error);
    throw error;
  }
}
