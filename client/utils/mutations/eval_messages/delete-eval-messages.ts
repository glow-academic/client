// utils/mutations/eval_messages/delete-eval-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalMessages(ids: string[]) {
  try {
    return await db.delete(evalMessages).where(inArray(evalMessages.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple eval_messages:", error);
    throw error;
  }
}
