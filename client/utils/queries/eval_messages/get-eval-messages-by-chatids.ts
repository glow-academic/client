// utils/queries/eval_messages/get-eval-messages-by-chatids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalMessagesByChatids(chatidIds: string[]) {
  try {
    return await db.select().from(evalMessages).where(inArray(evalMessages.chat_id, chatidIds));
  } catch (error) {
    console.error("Error fetching eval_messages by chatids:", error);
    throw error;
  }
}
