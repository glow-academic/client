// utils/mutations/eval_chat_standards/update-eval-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvalChatStandards(ids: string[], data: Partial<typeof evalChatStandards.$inferInsert>) {
  try {
    return await db.update(evalChatStandards).set(data).where(inArray(evalChatStandards.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple eval_chat_standards:", error);
    throw error;
  }
}
