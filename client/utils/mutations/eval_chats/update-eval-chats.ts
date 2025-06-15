// utils/mutations/eval_chats/update-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEvalChats(ids: string[], data: Partial<typeof evalChats.$inferInsert>) {
  try {
    return await db.update(evalChats).set(data).where(inArray(evalChats.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple eval_chats:", error);
    throw error;
  }
}
