// utils/queries/eval_chat_standards/get-all-eval-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";

export async function getAllEvalChatStandards() {
  try {
    return await db.select().from(evalChatStandards);
  } catch (error) {
    console.error("Error fetching all eval_chat_standards:", error);
    throw error;
  }
}
