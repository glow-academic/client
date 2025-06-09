// utils/mutations/eval_chat_standards/delete-eval-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvalChatStandards(ids: string[]) {
  try {
    return await db.delete(evalChatStandards).where(inArray(evalChatStandards.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple eval_chat_standards:", error);
    throw error;
  }
}
