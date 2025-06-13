// utils/queries/eval_chats/get-eval-chats-by-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatsByScenarios(scenarioIds: string[]) {
  try {
    return await db.select().from(evalChats).where(inArray(evalChats.scenarioId, scenarioIds));
  } catch (error) {
    logError("Error fetching eval_chats by scenarios:", error);
    throw error;
  }
}
