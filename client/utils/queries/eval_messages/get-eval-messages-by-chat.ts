// utils/queries/eval_messages/get-eval-messages-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalMessagesByChat(chatId: string) {
  try {
    return await db.select().from(evalMessages).where(eq(evalMessages.chatId, chatId));
  } catch (error) {
    console.error("Error fetching eval_messages by chat:", error);
    throw error;
  }
}
