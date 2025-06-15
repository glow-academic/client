// utils/mutations/eval_messages/create-eval-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalMessages(data: (typeof evalMessages.$inferInsert)[]) {
  try {
    return await db.insert(evalMessages).values(data).returning();
  } catch (error) {
    logError("Error creating multiple eval_messages:", error);
    throw error;
  }
}
