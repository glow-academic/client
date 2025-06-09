// utils/queries/eval_chat_rubrics/get-eval-chat-rubrics-by-eval-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatRubricsByEvalChat(evalChatId: string) {
  try {
    return await db.select().from(evalChatRubrics).where(eq(evalChatRubrics.evalChatId, evalChatId));
  } catch (error) {
    console.error("Error fetching eval_chat_rubrics by evalChat:", error);
    throw error;
  }
}
