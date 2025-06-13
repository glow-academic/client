// utils/mutations/topics/delete-topic.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteTopic(id: string) {
  try {
    const result = await db.delete(topics).where(eq(topics.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting topic:", error);
    throw error;
  }
}
