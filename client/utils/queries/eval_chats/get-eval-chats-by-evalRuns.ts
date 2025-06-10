// utils/queries/eval_chats/get-eval-chats-by-evalruns.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatsByEvalRuns(evalRunIds: string[]) {
  try {
    return await db.select().from(evalChats).where(inArray(evalChats.evalRunId, evalRunIds));
  } catch (error) {
    console.error("Error fetching eval_chats by evalRuns:", error);
    throw error;
  }
}
