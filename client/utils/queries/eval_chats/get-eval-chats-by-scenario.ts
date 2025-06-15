// utils/queries/eval_chats/get-eval-chats-by-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatsByScenario(scenarioId: string) {
  try {
    return await db.select().from(evalChats).where(eq(evalChats.scenarioId, scenarioId));
  } catch (error) {
    logError("Error fetching eval_chats by scenario:", error);
    throw error;
  }
}
