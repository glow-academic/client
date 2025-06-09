// utils/mutations/eval_chat_rubrics/delete-evalChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalChatRubric(id: string) {
  try {
    const result = await db.delete(evalChatRubrics).where(eq(evalChatRubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalChatRubric:", error);
    throw error;
  }
}
