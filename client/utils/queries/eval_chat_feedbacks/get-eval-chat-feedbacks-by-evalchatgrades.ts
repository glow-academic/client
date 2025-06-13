// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-eval-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatFeedbacksByEvalChatGrades(evalChatGradeIds: string[]) {
  try {
    return await db.select().from(evalChatFeedbacks).where(inArray(evalChatFeedbacks.evalChatGradeId, evalChatGradeIds));
  } catch (error) {
    logError("Error fetching eval_chat_feedbacks by evalChatGrades:", error);
    throw error;
  }
}
