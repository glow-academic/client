// utils/mutations/eval_chat_grades/create-eval-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalChatGrades(data: (typeof evalChatGrades.$inferInsert)[]) {
  try {
    return await db.insert(evalChatGrades).values(data).returning();
  } catch (error) {
    logError("Error creating multiple eval_chat_grades:", error);
    throw error;
  }
}
