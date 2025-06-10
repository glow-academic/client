// utils/queries/topics/get-all-topics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";

export async function getAllTopics() {
  try {
    return await db.select().from(topics);
  } catch (error) {
    console.error("Error fetching all topics:", error);
    throw error;
  }
}
