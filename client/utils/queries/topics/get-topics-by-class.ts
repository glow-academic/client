// utils/queries/topics/get-topics-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getTopicsByClass(classIds: string[]) {
  try {
    return await db.select().from(topics).where(inArray(topics.classId, classIds));
  } catch (error) {
    console.error("Error fetching topics by class:", error);
    throw error;
  }
}
