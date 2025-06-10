// utils/mutations/eval_chat_feedbacks/update-eval-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvalChatFeedbacks(
  ids: string[],
  data: Partial<typeof evalChatFeedbacks.$inferInsert>,
) {
  try {
    return await db
      .update(evalChatFeedbacks)
      .set(data)
      .where(inArray(evalChatFeedbacks.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple eval_chat_feedbacks:", error);
    throw error;
  }
}
