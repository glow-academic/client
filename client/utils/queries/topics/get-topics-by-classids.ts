// utils/queries/topics/get-topics-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getTopicsByClassids(classidIds: string[]) {
  try {
    return await db.select().from(topics).where(inArray(topics.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching topics by classids:", error);
    throw error;
  }
}
