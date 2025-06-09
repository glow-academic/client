// utils/queries/eval_chats/get-eval-chats-by-evalrunids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatsByEvalrunids(evalrunidIds: string[]) {
  try {
    return await db.select().from(evalChats).where(inArray(evalChats.eval_run_id, evalrunidIds));
  } catch (error) {
    console.error("Error fetching eval_chats by evalrunids:", error);
    throw error;
  }
}
