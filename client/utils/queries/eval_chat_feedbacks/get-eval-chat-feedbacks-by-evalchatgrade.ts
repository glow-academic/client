// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-eval-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatFeedbacksByEvalChatGrade(
  evalChatGradeId: string,
) {
  try {
    return await db
      .select()
      .from(evalChatFeedbacks)
      .where(eq(evalChatFeedbacks.evalChatGradeId, evalChatGradeId));
  } catch (error) {
    console.error(
      "Error fetching eval_chat_feedbacks by evalChatGrade:",
      error,
    );
    throw error;
  }
}
