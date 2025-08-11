// utils/mutations/rubrics/update-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateRubric(id: string, data: Partial<typeof rubrics.$inferInsert>) {
  try {
    const result = await db.update(rubrics).set(data).where(eq(rubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating rubric:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateRubric = createMockableAction('updateRubric', _updateRubric);
