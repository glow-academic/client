// utils/mutations/eval_chats/delete-eval-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalChat(id: string) {
  try {
    const result = await db.delete(evalChats).where(eq(evalChats.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalChat:", error);
    throw error;
  }
}
