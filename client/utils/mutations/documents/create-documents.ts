// utils/mutations/documents/create-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createDocuments(data: (typeof documents.$inferInsert)[]) {
  try {
    return await db.insert(documents).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple documents",
      subject: { entityType: "documents" },
      context: { function: "_createDocuments", file: "utils/mutations/documents/create-documents.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createDocuments = createMockableAction('createDocuments', _createDocuments);
