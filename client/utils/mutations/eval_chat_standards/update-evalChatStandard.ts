// utils/mutations/eval_chat_standards/update-evalChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvalChatStandard(id: string, data: Partial<typeof evalChatStandards.$inferInsert>) {
  try {
    const result = await db.update(evalChatStandards).set(data).where(eq(evalChatStandards.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating evalChatStandard:", error);
    throw error;
  }
}
