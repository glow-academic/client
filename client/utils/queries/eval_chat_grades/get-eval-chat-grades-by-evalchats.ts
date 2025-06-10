// utils/queries/eval_chat_grades/get-eval-chat-grades-by-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatGradesByEvalChats(evalChatIds: string[]) {
  try {
    return await db.select().from(evalChatGrades).where(inArray(evalChatGrades.evalChatId, evalChatIds));
  } catch (error) {
    console.error("Error fetching eval_chat_grades by evalChats:", error);
    throw error;
  }
}
