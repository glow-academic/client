// utils/queries/eval_chat_feedbacks/get-evalChatFeedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatFeedback(id: string) {
  try {
    const result = await db
      .select()
      .from(evalChatFeedbacks)
      .where(eq(evalChatFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching evalChatFeedback:", error);
    throw error;
  }
}
