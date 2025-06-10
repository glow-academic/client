// utils/mutations/eval_chat_feedbacks/delete-eval-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvalChatFeedbacks(ids: string[]) {
  try {
    return await db
      .delete(evalChatFeedbacks)
      .where(inArray(evalChatFeedbacks.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple eval_chat_feedbacks:", error);
    throw error;
  }
}
