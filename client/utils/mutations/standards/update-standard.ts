// utils/mutations/standards/update-standard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateStandard(id: string, data: Partial<typeof standards.$inferInsert>) {
  try {
    const result = await db.update(standards).set(data).where(eq(standards.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating standard",
      subject: { entityType: "standards", entityId: String(id) },
      context: { function: "_updateStandard", file: "utils/mutations/standards/update-standard.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateStandard = createMockableAction('updateStandard', _updateStandard);
