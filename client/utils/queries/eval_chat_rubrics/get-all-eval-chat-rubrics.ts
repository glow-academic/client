// utils/queries/eval_chat_rubrics/get-all-eval-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";

export async function getAllEvalChatRubrics() {
  try {
    return await db.select().from(evalChatRubrics);
  } catch (error) {
    console.error("Error fetching all eval_chat_rubrics:", error);
    throw error;
  }
}
