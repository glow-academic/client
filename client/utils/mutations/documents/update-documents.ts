// utils/mutations/documents/update-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateDocuments(ids: string[], data: Partial<typeof documents.$inferInsert>) {
  try {
    return await db.update(documents).set(data).where(inArray(documents.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple documents",
      subject: { entityType: "documents" },
      context: { function: "_updateDocuments", file: "utils/mutations/documents/update-documents.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateDocuments = createMockableAction('updateDocuments', _updateDocuments);
