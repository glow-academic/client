// utils/mutations/eval_chat_feedbacks/delete-eval-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalChatFeedbacks(ids: string[]) {
  try {
    return await db.delete(evalChatFeedbacks).where(inArray(evalChatFeedbacks.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple eval_chat_feedbacks:", error);
    throw error;
  }
}
