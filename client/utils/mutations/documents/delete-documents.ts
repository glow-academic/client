// utils/mutations/documents/delete-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteDocuments(ids: string[]) {
  try {
    return await db.delete(documents).where(inArray(documents.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple documents",
      subject: { entityType: "documents" },
      context: { function: "_deleteDocuments", file: "utils/mutations/documents/delete-documents.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteDocuments = createMockableAction('deleteDocuments', _deleteDocuments);
