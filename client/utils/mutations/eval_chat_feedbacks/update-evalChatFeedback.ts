// utils/mutations/eval_chat_feedbacks/update-evalChatFeedback.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvalChatFeedback(
  id: string,
  data: Partial<typeof evalChatFeedbacks.$inferInsert>,
) {
  try {
    const result = await db
      .update(evalChatFeedbacks)
      .set(data)
      .where(eq(evalChatFeedbacks.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating evalChatFeedback:", error);
    throw error;
  }
}
