// utils/queries/eval_chats/get-eval-chats-by-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatsByEvalRuns(evalRunIds: string[]) {
  try {
    return await db.select().from(evalChats).where(inArray(evalChats.evalRunId, evalRunIds));
  } catch (error) {
    logError("Error fetching eval_chats by evalRuns:", error);
    throw error;
  }
}
