// utils/mutations/eval_chat_feedbacks/create-evalChatFeedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";

export async function createEvalChatFeedback(data: typeof evalChatFeedbacks.$inferInsert) {
  try {
    const result = await db.insert(evalChatFeedbacks).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalChatFeedback:", error);
    throw error;
  }
}
