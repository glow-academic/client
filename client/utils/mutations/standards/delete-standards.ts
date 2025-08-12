// utils/mutations/standards/delete-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteStandards(ids: string[]) {
  try {
    return await db.delete(standards).where(inArray(standards.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple standards",
      subject: { entityType: "standards" },
      context: { function: "_deleteStandards", file: "utils/mutations/standards/delete-standards.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteStandards = createMockableAction('deleteStandards', _deleteStandards);
