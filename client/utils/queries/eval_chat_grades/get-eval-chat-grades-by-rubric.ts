// utils/queries/eval_chat_grades/get-eval-chat-grades-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatGradesByRubric(rubricId: string) {
  try {
    return await db.select().from(evalChatGrades).where(eq(evalChatGrades.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching eval_chat_grades by rubric:", error);
    throw error;
  }
}
