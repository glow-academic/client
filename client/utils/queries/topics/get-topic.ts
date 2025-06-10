// utils/queries/topics/get-topic.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getTopic(id: string) {
  try {
    const result = await db.select().from(topics).where(eq(topics.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching topic:", error);
    throw error;
  }
}
