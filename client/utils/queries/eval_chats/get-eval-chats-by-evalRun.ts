// utils/queries/eval_chats/get-eval-chats-by-evalRun.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatsByEvalRun(evalRunId: string) {
  try {
    return await db.select().from(evalChats).where(eq(evalChats.evalRunId, evalRunId));
  } catch (error) {
    console.error("Error fetching eval_chats by evalRun:", error);
    throw error;
  }
}
