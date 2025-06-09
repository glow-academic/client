// utils/queries/eval_chat_rubrics/get-eval-chat-rubrics-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatRubricsByRubric(rubricId: string) {
  try {
    return await db.select().from(evalChatRubrics).where(eq(evalChatRubrics.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching eval_chat_rubrics by rubric:", error);
    throw error;
  }
}
