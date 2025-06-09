// utils/mutations/eval_chat_rubrics/delete-eval-chat-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvalChatRubrics(ids: string[]) {
  try {
    return await db.delete(evalChatRubrics).where(inArray(evalChatRubrics.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple eval_chat_rubrics:", error);
    throw error;
  }
}
