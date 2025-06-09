// utils/mutations/eval_chat_standards/delete-evalChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalChatStandard(id: string) {
  try {
    const result = await db.delete(evalChatStandards).where(eq(evalChatStandards.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalChatStandard:", error);
    throw error;
  }
}
