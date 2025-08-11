// utils/mutations/documents/update-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateDocument(id: string, data: Partial<typeof documents.$inferInsert>) {
  try {
    const result = await db.update(documents).set(data).where(eq(documents.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating document:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateDocument = createMockableAction('updateDocument', _updateDocument);
