// utils/mutations/topics/create-topics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createTopics(data: (typeof topics.$inferInsert)[]) {
  try {
    return await db.insert(topics).values(data).returning();
  } catch (error) {
    logError("Error creating multiple topics:", error);
    throw error;
  }
}
