// utils/mutations/eval_chat_grades/delete-evalChatGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalChatGrade(id: string) {
  try {
    const result = await db.delete(evalChatGrades).where(eq(evalChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalChatGrade:", error);
    throw error;
  }
}
