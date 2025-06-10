// utils/mutations/eval_chats/update-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvalChats(ids: string[], data: Partial<typeof evalChats.$inferInsert>) {
  try {
    return await db.update(evalChats).set(data).where(inArray(evalChats.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple eval_chats:", error);
    throw error;
  }
}
