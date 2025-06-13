// utils/queries/eval_chat_feedbacks/get-all-eval-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvalChatFeedbacks() {
  try {
    return await db.select().from(evalChatFeedbacks);
  } catch (error) {
    logError("Error fetching all eval_chat_feedbacks:", error);
    throw error;
  }
}
