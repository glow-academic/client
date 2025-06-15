// utils/queries/topics/get-topics-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { topics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getTopicsByClass(classIds: string[]) {
  try {
    return await db.select().from(topics).where(inArray(topics.classId, classIds));
  } catch (error) {
    logError("Error fetching topics by class:", error);
    throw error;
  }
}
