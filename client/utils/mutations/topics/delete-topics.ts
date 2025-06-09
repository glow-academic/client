// utils/mutations/topics/delete-topics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteTopics(ids: string[]) {
  try {
    return await db.delete(topics).where(inArray(topics.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple topics:", error);
    throw error;
  }
}
