// utils/mutations/eval_chat_grades/update-evalChatGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvalChatGrade(
  id: string,
  data: Partial<typeof evalChatGrades.$inferInsert>,
) {
  try {
    const result = await db
      .update(evalChatGrades)
      .set(data)
      .where(eq(evalChatGrades.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating evalChatGrade:", error);
    throw error;
  }
}
