// utils/queries/eval_chat_grades/get-all-eval-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatGrades } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvalChatGrades() {
  try {
    return await db.select().from(evalChatGrades);
  } catch (error) {
    logError("Error fetching all eval_chat_grades:", error);
    throw error;
  }
}
