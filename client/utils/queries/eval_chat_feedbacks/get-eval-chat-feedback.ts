// utils/queries/eval_chat_feedbacks/get-eval-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatFeedback(id: string) {
  try {
    const result = await db.select().from(evalChatFeedbacks).where(eq(evalChatFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching evalChatFeedback:", error);
    throw error;
  }
}
