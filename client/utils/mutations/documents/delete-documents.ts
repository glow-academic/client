// utils/mutations/documents/delete-documents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteDocuments(ids: string[]) {
  try {
    return await db.delete(documents).where(inArray(documents.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple documents:", error);
    throw error;
  }
}
