// utils/mutations/standards/delete-standard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteStandard(id: string) {
  try {
    const result = await db.delete(standards).where(eq(standards.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting standard",
      subject: { entityType: "standards", entityId: String(id) },
      context: { function: "_deleteStandard", file: "utils/mutations/standards/delete-standard.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteStandard = createMockableAction('deleteStandard', _deleteStandard);
