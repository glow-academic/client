// utils/queries/documents/get-all-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllDocuments() {
  try {
    return await db.select().from(documents);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all documents",
      subject: { entityType: "documents" },
      context: { function: "_getAllDocuments", file: "utils/queries/documents/get-all-documents.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllDocuments = createMockableAction('getAllDocuments', _getAllDocuments);
