// utils/queries/eval_messages/get-eval-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalMessage(id: string) {
  try {
    const result = await db.select().from(evalMessages).where(eq(evalMessages.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching evalMessage:", error);
    throw error;
  }
}
