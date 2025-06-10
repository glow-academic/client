// utils/mutations/eval_chat_grades/create-evalChatGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";

export async function createEvalChatGrade(
  data: typeof evalChatGrades.$inferInsert,
) {
  try {
    const result = await db.insert(evalChatGrades).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalChatGrade:", error);
    throw error;
  }
}
