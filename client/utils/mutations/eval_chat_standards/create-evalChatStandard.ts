// utils/mutations/eval_chat_standards/create-evalChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";

export async function createEvalChatStandard(data: typeof evalChatStandards.$inferInsert) {
  try {
    const result = await db.insert(evalChatStandards).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalChatStandard:", error);
    throw error;
  }
}
