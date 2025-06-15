// utils/queries/eval_messages/get-eval-messages-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalMessagesByChat(chatId: string) {
  try {
    return await db.select().from(evalMessages).where(eq(evalMessages.chatId, chatId));
  } catch (error) {
    logError("Error fetching eval_messages by chat:", error);
    throw error;
  }
}
