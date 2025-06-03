// utils/queries/get-chat-templates.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chatTemplates } from "@/drizzle/schema";

export async function getChatTemplates() {
  const fetchedChatTemplates = await db.select().from(chatTemplates);
  return fetchedChatTemplates;
}
