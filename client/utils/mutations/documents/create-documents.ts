// utils/mutations/documents/create-documents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDocuments(data: (typeof documents.$inferInsert)[]) {
  try {
    return await db.insert(documents).values(data).returning();
  } catch (error) {
    logError("Error creating multiple documents:", error);
    throw error;
  }
}
