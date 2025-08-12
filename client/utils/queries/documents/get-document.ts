// utils/queries/documents/get-document.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getDocument(id: string) {
  try {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching document",
      subject: { entityType: "documents", entityId: String(id) },
      context: { function: "_getDocument", file: "utils/queries/documents/get-document.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getDocument = createMockableAction('getDocument', _getDocument);
