// utils/queries/eval_messages/get-eval-messages-by-chatid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalMessagesByChatid(chatidId: string) {
  try {
    return await db.select().from(evalMessages).where(eq(evalMessages.chat_id, chatidId));
  } catch (error) {
    console.error("Error fetching eval_messages by chatid:", error);
    throw error;
  }
}
