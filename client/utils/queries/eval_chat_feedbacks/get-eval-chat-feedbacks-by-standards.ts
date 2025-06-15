// utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalChatFeedbacksByStandards(standardIds: string[]) {
  try {
    return await db.select().from(evalChatFeedbacks).where(inArray(evalChatFeedbacks.standardId, standardIds));
  } catch (error) {
    logError("Error fetching eval_chat_feedbacks by standards:", error);
    throw error;
  }
}
