// utils/queries/eval_chats/get-eval-chats-by-evalruns.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatsByEvalruns(evalrunIds: string[]) {
  try {
    return await db.select().from(evalChats).where(inArray(evalChats.eval_run_id, evalrunIds));
  } catch (error) {
    console.error("Error fetching eval_chats by evalruns:", error);
    throw error;
  }
}
