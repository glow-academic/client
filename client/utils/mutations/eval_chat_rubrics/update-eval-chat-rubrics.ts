// utils/mutations/eval_chat_rubrics/update-eval-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvalChatRubrics(ids: string[], data: Partial<typeof evalChatRubrics.$inferInsert>) {
  try {
    return await db.update(evalChatRubrics).set(data).where(inArray(evalChatRubrics.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple eval_chat_rubrics:", error);
    throw error;
  }
}
