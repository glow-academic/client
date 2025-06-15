// utils/mutations/topics/delete-topics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { topics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteTopics(ids: string[]) {
  try {
    return await db.delete(topics).where(inArray(topics.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple topics:", error);
    throw error;
  }
}
