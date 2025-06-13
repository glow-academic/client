// utils/mutations/documents/delete-document.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteDocument(id: string) {
  try {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting document:", error);
    throw error;
  }
}
