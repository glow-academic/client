// utils/mutations/eval_chat_grades/delete-eval-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvalChatGrades(ids: string[]) {
  try {
    return await db
      .delete(evalChatGrades)
      .where(inArray(evalChatGrades.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple eval_chat_grades:", error);
    throw error;
  }
}
