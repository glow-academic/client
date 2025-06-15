// utils/mutations/documents/create-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDocument(data: typeof documents.$inferInsert) {
  try {
    const result = await db.insert(documents).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating document:", error);
    throw error;
  }
}
