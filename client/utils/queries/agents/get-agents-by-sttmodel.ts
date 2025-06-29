// utils/queries/agents/get-agents-by-stt-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAgentsBySttModel(sttModelId: string) {
  try {
    return await db.select().from(agents).where(eq(agents.sttModelId, sttModelId));
  } catch (error) {
    logError("Error fetching agents by sttModel:", error);
    throw error;
  }
}
