// utils/mutations/assistant_messages/update-assistant-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAssistantMessage(
  id: string,
  data: Partial<typeof assistantMessages.$inferInsert>,
) {
  try {
    const result = await db
      .update(assistantMessages)
      .set(data)
      .where(eq(assistantMessages.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating assistantMessage:", error);
    throw error;
  }
}
