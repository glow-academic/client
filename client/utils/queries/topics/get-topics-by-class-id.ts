// utils/queries/topics/get-topics-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getTopicsByClassid(classidId: string) {
  try {
    return await db.select().from(topics).where(eq(topics.class_id, classidId));
  } catch (error) {
    console.error("Error fetching topics by classid:", error);
    throw error;
  }
}
