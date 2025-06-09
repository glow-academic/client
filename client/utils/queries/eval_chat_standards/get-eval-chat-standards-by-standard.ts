// utils/queries/eval_chat_standards/get-eval-chat-standards-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatStandardsByStandard(standardId: string) {
  try {
    return await db.select().from(evalChatStandards).where(eq(evalChatStandards.standardId, standardId));
  } catch (error) {
    console.error("Error fetching eval_chat_standards by standard:", error);
    throw error;
  }
}
