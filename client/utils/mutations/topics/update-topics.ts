// utils/mutations/topics/update-topics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateTopics(
  ids: string[],
  data: Partial<typeof topics.$inferInsert>,
) {
  try {
    return await db
      .update(topics)
      .set(data)
      .where(inArray(topics.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple topics:", error);
    throw error;
  }
}
