// utils/mutations/eval_messages/create-eval-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalMessage(data: typeof evalMessages.$inferInsert) {
  try {
    const result = await db.insert(evalMessages).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating evalMessage:", error);
    throw error;
  }
}
