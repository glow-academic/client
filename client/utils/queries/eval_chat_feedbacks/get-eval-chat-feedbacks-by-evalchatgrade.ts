// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-eval-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatFeedbacksByEvalChatGrade(evalChatGradeId: string) {
  try {
    return await db.select().from(evalChatFeedbacks).where(eq(evalChatFeedbacks.evalChatGradeId, evalChatGradeId));
  } catch (error) {
    logError("Error fetching eval_chat_feedbacks by evalChatGrade:", error);
    throw error;
  }
}
