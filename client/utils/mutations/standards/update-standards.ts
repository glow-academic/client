// utils/mutations/standards/update-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateStandards(ids: string[], data: Partial<typeof standards.$inferInsert>) {
  try {
    return await db.update(standards).set(data).where(inArray(standards.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple standards",
      subject: { entityType: "standards" },
      context: { function: "_updateStandards", file: "utils/mutations/standards/update-standards.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateStandards = createMockableAction('updateStandards', _updateStandards);
