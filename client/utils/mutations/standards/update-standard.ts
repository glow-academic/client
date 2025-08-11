// utils/mutations/standards/update-standard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateStandard(id: string, data: Partial<typeof standards.$inferInsert>) {
  try {
    const result = await db.update(standards).set(data).where(eq(standards.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating standard:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateStandard = createMockableAction('updateStandard', _updateStandard);
