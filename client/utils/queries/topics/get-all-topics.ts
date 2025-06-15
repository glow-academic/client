// utils/queries/topics/get-all-topics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { topics } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllTopics() {
  try {
    return await db.select().from(topics);
  } catch (error) {
    logError("Error fetching all topics:", error);
    throw error;
  }
}
