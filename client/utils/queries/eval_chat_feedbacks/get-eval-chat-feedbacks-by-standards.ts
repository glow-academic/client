// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatFeedbacksByStandards(standardIds: string[]) {
  try {
    return await db
      .select()
      .from(evalChatFeedbacks)
      .where(inArray(evalChatFeedbacks.standardId, standardIds));
  } catch (error) {
    console.error("Error fetching eval_chat_feedbacks by standards:", error);
    throw error;
  }
}
