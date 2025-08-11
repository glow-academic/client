// utils/mutations/documents/create-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createDocument(data: typeof documents.$inferInsert) {
  try {
    const result = await db.insert(documents).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating document:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createDocument = createMockableAction('createDocument', _createDocument);
