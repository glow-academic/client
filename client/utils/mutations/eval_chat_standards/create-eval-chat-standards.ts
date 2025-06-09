// utils/mutations/eval_chat_standards/create-eval-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";

export async function createEvalChatStandards(data: (typeof evalChatStandards.$inferInsert)[]) {
  try {
    return await db.insert(evalChatStandards).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple eval_chat_standards:", error);
    throw error;
  }
}
