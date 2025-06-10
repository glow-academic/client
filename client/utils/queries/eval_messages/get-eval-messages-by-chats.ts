// utils/queries/eval_messages/get-eval-messages-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalMessagesByChats(chatIds: string[]) {
  try {
    return await db
      .select()
      .from(evalMessages)
      .where(inArray(evalMessages.chatId, chatIds));
  } catch (error) {
    console.error("Error fetching eval_messages by chats:", error);
    throw error;
  }
}
