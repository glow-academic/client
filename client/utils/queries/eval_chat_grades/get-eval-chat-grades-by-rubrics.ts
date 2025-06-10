// utils/queries/eval_chat_grades/get-eval-chat-grades-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatGradesByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(evalChatGrades).where(inArray(evalChatGrades.rubricId, rubricIds));
  } catch (error) {
    console.error("Error fetching eval_chat_grades by rubrics:", error);
    throw error;
  }
}
