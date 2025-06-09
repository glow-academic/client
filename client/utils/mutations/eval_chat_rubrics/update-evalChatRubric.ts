// utils/mutations/eval_chat_rubrics/update-evalChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvalChatRubric(id: string, data: Partial<typeof evalChatRubrics.$inferInsert>) {
  try {
    const result = await db.update(evalChatRubrics).set(data).where(eq(evalChatRubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating evalChatRubric:", error);
    throw error;
  }
}
