// utils/queries/eval_chat_standards/get-eval-chat-standards-by-eval-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatStandardsByEvalChatRubrics(evalChatRubricIds: string[]) {
  try {
    return await db.select().from(evalChatStandards).where(inArray(evalChatStandards.evalChatRubricId, evalChatRubricIds));
  } catch (error) {
    console.error("Error fetching eval_chat_standards by evalChatRubrics:", error);
    throw error;
  }
}
