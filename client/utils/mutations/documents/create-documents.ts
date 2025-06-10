// utils/mutations/documents/create-documents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";

export async function createDocuments(data: (typeof documents.$inferInsert)[]) {
  try {
    return await db.insert(documents).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple documents:", error);
    throw error;
  }
}
