// utils/queries/documents/get-all-documents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllDocuments() {
  try {
    return await db.select().from(documents);
  } catch (error) {
    logError("Error fetching all documents:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllDocuments = createMockableAction('getAllDocuments', _getAllDocuments);
