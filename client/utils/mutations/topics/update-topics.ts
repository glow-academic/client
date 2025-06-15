// utils/mutations/topics/update-topics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { topics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateTopics(ids: string[], data: Partial<typeof topics.$inferInsert>) {
  try {
    return await db.update(topics).set(data).where(inArray(topics.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple topics:", error);
    throw error;
  }
}
