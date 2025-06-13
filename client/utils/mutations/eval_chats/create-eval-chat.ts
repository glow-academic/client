// utils/mutations/eval_chats/create-eval-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalChat(data: typeof evalChats.$inferInsert) {
  try {
    const result = await db.insert(evalChats).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating evalChat:", error);
    throw error;
  }
}
