// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatFeedbacksByStandard(standardId: string) {
  try {
    return await db.select().from(evalChatFeedbacks).where(eq(evalChatFeedbacks.standardId, standardId));
  } catch (error) {
    logError("Error fetching eval_chat_feedbacks by standard:", error);
    throw error;
  }
}
