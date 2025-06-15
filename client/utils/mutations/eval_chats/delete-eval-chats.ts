// utils/mutations/eval_chats/delete-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalChats(ids: string[]) {
  try {
    return await db.delete(evalChats).where(inArray(evalChats.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple eval_chats:", error);
    throw error;
  }
}
