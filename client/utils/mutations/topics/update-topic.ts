// utils/mutations/topics/update-topic.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateTopic(id: string, data: Partial<typeof topics.$inferInsert>) {
  try {
    const result = await db.update(topics).set(data).where(eq(topics.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating topic:", error);
    throw error;
  }
}
