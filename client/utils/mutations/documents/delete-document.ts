// utils/mutations/documents/delete-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteDocument(id: string) {
  try {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting document",
      subject: { entityType: "documents", entityId: String(id) },
      context: { function: "_deleteDocument", file: "utils/mutations/documents/delete-document.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteDocument = createMockableAction('deleteDocument', _deleteDocument);
