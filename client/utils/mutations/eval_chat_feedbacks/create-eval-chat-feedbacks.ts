// utils/mutations/eval_chat_feedbacks/create-eval-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";

export async function createEvalChatFeedbacks(
  data: (typeof evalChatFeedbacks.$inferInsert)[],
) {
  try {
    return await db.insert(evalChatFeedbacks).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple eval_chat_feedbacks:", error);
    throw error;
  }
}
