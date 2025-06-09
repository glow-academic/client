// utils/queries/eval_chat_rubrics/get-eval-chat-rubrics-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatRubricsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(evalChatRubrics).where(inArray(evalChatRubrics.rubricId, rubricIds));
  } catch (error) {
    console.error("Error fetching eval_chat_rubrics by rubrics:", error);
    throw error;
  }
}
