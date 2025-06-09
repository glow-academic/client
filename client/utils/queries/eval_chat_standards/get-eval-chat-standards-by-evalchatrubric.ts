// utils/queries/eval_chat_standards/get-eval-chat-standards-by-eval-chat-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatStandardsByEvalChatRubric(evalChatRubricId: string) {
  try {
    return await db.select().from(evalChatStandards).where(eq(evalChatStandards.evalChatRubricId, evalChatRubricId));
  } catch (error) {
    console.error("Error fetching eval_chat_standards by evalChatRubric:", error);
    throw error;
  }
}
