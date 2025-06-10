// utils/queries/eval_chat_grades/get-eval-chat-grades-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatGradesByRubric(rubricId: string) {
  try {
    return await db.select().from(evalChatGrades).where(eq(evalChatGrades.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching eval_chat_grades by rubric:", error);
    throw error;
  }
}
