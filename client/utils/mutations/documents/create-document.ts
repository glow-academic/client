// utils/mutations/documents/create-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createDocument(data: typeof documents.$inferInsert) {
  try {
    const result = await db.insert(documents).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating document",
      subject: { entityType: "documents" },
      context: { function: "_createDocument", file: "utils/mutations/documents/create-document.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createDocument = createMockableAction('createDocument', _createDocument);
