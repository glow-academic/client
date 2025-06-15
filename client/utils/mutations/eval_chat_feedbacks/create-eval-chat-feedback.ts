// utils/mutations/eval_chat_feedbacks/create-eval-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalChatFeedback(data: typeof evalChatFeedbacks.$inferInsert) {
  try {
    const result = await db.insert(evalChatFeedbacks).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating evalChatFeedback:", error);
    throw error;
  }
}
