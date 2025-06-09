// utils/mutations/eval_chat_rubrics/create-evalChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";

export async function createEvalChatRubric(data: typeof evalChatRubrics.$inferInsert) {
  try {
    const result = await db.insert(evalChatRubrics).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalChatRubric:", error);
    throw error;
  }
}
