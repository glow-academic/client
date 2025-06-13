// utils/mutations/topics/create-topic.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createTopic(data: typeof topics.$inferInsert) {
  try {
    const result = await db.insert(topics).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating topic:", error);
    throw error;
  }
}
