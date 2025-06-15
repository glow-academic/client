// utils/mutations/eval_messages/delete-eval-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalMessage(id: string) {
  try {
    const result = await db.delete(evalMessages).where(eq(evalMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting evalMessage:", error);
    throw error;
  }
}
