// utils/queries/get-chat-template.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chatTemplates } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getChatTemplate(chatTemplateId: string) {
  const chatTemplate = await db
    .select()
    .from(chatTemplates)
    .where(eq(chatTemplates.id, chatTemplateId))
    .limit(1);
  return chatTemplate[0] || null;
}
