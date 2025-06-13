// utils/queries/eval_messages/get-all-eval-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvalMessages() {
  try {
    return await db.select().from(evalMessages);
  } catch (error) {
    logError("Error fetching all eval_messages:", error);
    throw error;
  }
}
