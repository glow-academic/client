// utils/queries/eval_chats/get-eval-chats-by-evalrun.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatsByEvalrun(evalrunId: string) {
  try {
    return await db.select().from(evalChats).where(eq(evalChats.eval_run_id, evalrunId));
  } catch (error) {
    console.error("Error fetching eval_chats by evalrun:", error);
    throw error;
  }
}
