// utils/mutations/documents/update-documents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateDocuments(ids: string[], data: Partial<typeof documents.$inferInsert>) {
  try {
    return await db.update(documents).set(data).where(inArray(documents.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple documents:", error);
    throw error;
  }
}
