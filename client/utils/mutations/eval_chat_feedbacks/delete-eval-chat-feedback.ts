// utils/mutations/eval_chat_feedbacks/delete-eval-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalChatFeedback(id: string) {
  try {
    const result = await db.delete(evalChatFeedbacks).where(eq(evalChatFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting evalChatFeedback:", error);
    throw error;
  }
}
