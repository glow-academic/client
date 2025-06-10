// utils/mutations/eval_chat_grades/update-eval-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvalChatGrades(
  ids: string[],
  data: Partial<typeof evalChatGrades.$inferInsert>,
) {
  try {
    return await db
      .update(evalChatGrades)
      .set(data)
      .where(inArray(evalChatGrades.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple eval_chat_grades:", error);
    throw error;
  }
}
