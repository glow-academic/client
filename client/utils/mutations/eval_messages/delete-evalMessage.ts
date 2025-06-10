// utils/mutations/eval_messages/delete-evalMessage.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalMessage(id: string) {
  try {
    const result = await db.delete(evalMessages).where(eq(evalMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalMessage:", error);
    throw error;
  }
}
