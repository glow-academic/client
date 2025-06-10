// utils/mutations/eval_messages/create-evalMessage.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";

export async function createEvalMessage(data: typeof evalMessages.$inferInsert) {
  try {
    const result = await db.insert(evalMessages).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalMessage:", error);
    throw error;
  }
}
