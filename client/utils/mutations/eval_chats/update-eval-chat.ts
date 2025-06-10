// utils/mutations/eval_chats/update-eval-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvalChat(id: string, data: Partial<typeof evalChats.$inferInsert>) {
  try {
    const result = await db.update(evalChats).set(data).where(eq(evalChats.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating evalChat:", error);
    throw error;
  }
}
