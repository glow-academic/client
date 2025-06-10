// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatFeedbacksByStandard(standardId: string) {
  try {
    return await db.select().from(evalChatFeedbacks).where(eq(evalChatFeedbacks.standardId, standardId));
  } catch (error) {
    console.error("Error fetching eval_chat_feedbacks by standard:", error);
    throw error;
  }
}
