// utils/queries/eval_chat_standards/get-evalChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatStandard(id: string) {
  try {
    const result = await db.select().from(evalChatStandards).where(eq(evalChatStandards.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching evalChatStandard:", error);
    throw error;
  }
}
