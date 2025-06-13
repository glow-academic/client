// utils/queries/eval_chat_grades/get-eval-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatGrade(id: string) {
  try {
    const result = await db.select().from(evalChatGrades).where(eq(evalChatGrades.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching evalChatGrade:", error);
    throw error;
  }
}
