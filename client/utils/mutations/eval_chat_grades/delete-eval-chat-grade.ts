// utils/mutations/eval_chat_grades/delete-eval-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalChatGrade(id: string) {
  try {
    const result = await db.delete(evalChatGrades).where(eq(evalChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting evalChatGrade:", error);
    throw error;
  }
}
