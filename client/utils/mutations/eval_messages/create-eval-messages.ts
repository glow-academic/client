// utils/mutations/eval_messages/create-eval-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";

export async function createEvalMessages(data: (typeof evalMessages.$inferInsert)[]) {
  try {
    return await db.insert(evalMessages).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple eval_messages:", error);
    throw error;
  }
}
