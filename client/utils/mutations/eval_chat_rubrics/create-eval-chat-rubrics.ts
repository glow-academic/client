// utils/mutations/eval_chat_rubrics/create-eval-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";

export async function createEvalChatRubrics(data: (typeof evalChatRubrics.$inferInsert)[]) {
  try {
    return await db.insert(evalChatRubrics).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple eval_chat_rubrics:", error);
    throw error;
  }
}
