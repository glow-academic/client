// utils/mutations/eval_messages/update-eval-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEvalMessage(id: string, data: Partial<typeof evalMessages.$inferInsert>) {
  try {
    const result = await db.update(evalMessages).set(data).where(eq(evalMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating evalMessage:", error);
    throw error;
  }
}
