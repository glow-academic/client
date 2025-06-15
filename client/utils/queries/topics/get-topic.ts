// utils/queries/topics/get-topic.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { topics } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getTopic(id: string) {
  try {
    const result = await db.select().from(topics).where(eq(topics.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching topic:", error);
    throw error;
  }
}
