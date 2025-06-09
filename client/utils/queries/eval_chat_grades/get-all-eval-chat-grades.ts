// utils/queries/eval_chat_grades/get-all-eval-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";

export async function getAllEvalChatGrades() {
  try {
    return await db.select().from(evalChatGrades);
  } catch (error) {
    console.error("Error fetching all eval_chat_grades:", error);
    throw error;
  }
}
