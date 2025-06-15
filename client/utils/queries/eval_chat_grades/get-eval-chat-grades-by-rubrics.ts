// utils/queries/eval_chat_grades/get-eval-chat-grades-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatGrades } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatGradesByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(evalChatGrades).where(inArray(evalChatGrades.rubricId, rubricIds));
  } catch (error) {
    logError("Error fetching eval_chat_grades by rubrics:", error);
    throw error;
  }
}
