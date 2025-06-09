// utils/mutations/eval_chats/create-evalChat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";

export async function createEvalChat(data: typeof evalChats.$inferInsert) {
  try {
    const result = await db.insert(evalChats).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalChat:", error);
    throw error;
  }
}
