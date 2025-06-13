// utils/mutations/eval_messages/update-eval-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEvalMessages(ids: string[], data: Partial<typeof evalMessages.$inferInsert>) {
  try {
    return await db.update(evalMessages).set(data).where(inArray(evalMessages.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple eval_messages:", error);
    throw error;
  }
}
