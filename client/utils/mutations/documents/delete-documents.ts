// utils/mutations/documents/delete-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteDocuments(ids: string[]) {
  try {
    return await db.delete(documents).where(inArray(documents.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple documents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteDocuments = createMockableAction('deleteDocuments', _deleteDocuments);
