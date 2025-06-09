// utils/mutations/eval_chat_feedbacks/delete-evalChatFeedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalChatFeedback(id: string) {
  try {
    const result = await db.delete(evalChatFeedbacks).where(eq(evalChatFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalChatFeedback:", error);
    throw error;
  }
}
