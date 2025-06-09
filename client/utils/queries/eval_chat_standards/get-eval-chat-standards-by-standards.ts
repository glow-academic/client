// utils/queries/eval_chat_standards/get-eval-chat-standards-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatStandardsByStandards(standardIds: string[]) {
  try {
    return await db.select().from(evalChatStandards).where(inArray(evalChatStandards.standardId, standardIds));
  } catch (error) {
    console.error("Error fetching eval_chat_standards by standards:", error);
    throw error;
  }
}
