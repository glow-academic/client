// utils/mutations/documents/create-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createDocuments(data: (typeof documents.$inferInsert)[]) {
  try {
    return await db.insert(documents).values(data).returning();
  } catch (error) {
    logError("Error creating multiple documents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createDocuments = createMockableAction('createDocuments', _createDocuments);
