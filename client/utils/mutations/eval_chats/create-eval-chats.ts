// utils/mutations/eval_chats/create-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";

export async function createEvalChats(data: (typeof evalChats.$inferInsert)[]) {
  try {
    return await db.insert(evalChats).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple eval_chats:", error);
    throw error;
  }
}
