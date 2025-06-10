// utils/queries/eval_chat_grades/get-eval-chat-grades-by-eval-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatGradesByEvalChat(evalChatId: string) {
  try {
    return await db.select().from(evalChatGrades).where(eq(evalChatGrades.evalChatId, evalChatId));
  } catch (error) {
    console.error("Error fetching eval_chat_grades by evalChat:", error);
    throw error;
  }
}
