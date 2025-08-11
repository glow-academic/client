// utils/mutations/documents/update-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateDocuments(ids: string[], data: Partial<typeof documents.$inferInsert>) {
  try {
    return await db.update(documents).set(data).where(inArray(documents.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple documents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateDocuments = createMockableAction('updateDocuments', _updateDocuments);
