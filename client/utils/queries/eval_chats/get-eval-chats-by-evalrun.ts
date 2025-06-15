// utils/queries/eval_chats/get-eval-chats-by-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatsByEvalRun(evalRunId: string) {
  try {
    return await db.select().from(evalChats).where(eq(evalChats.evalRunId, evalRunId));
  } catch (error) {
    logError("Error fetching eval_chats by evalRun:", error);
    throw error;
  }
}
