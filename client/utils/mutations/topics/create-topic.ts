// utils/mutations/topics/create-topic.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";

export async function createTopic(data: typeof topics.$inferInsert) {
  try {
    const result = await db.insert(topics).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating topic:", error);
    throw error;
  }
}
