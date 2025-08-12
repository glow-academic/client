// utils/mutations/rubrics/update-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateRubric(id: string, data: Partial<typeof rubrics.$inferInsert>) {
  try {
    const result = await db.update(rubrics).set(data).where(eq(rubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating rubric",
      subject: { entityType: "rubrics", entityId: String(id) },
      context: { function: "_updateRubric", file: "utils/mutations/rubrics/update-rubric.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateRubric = createMockableAction('updateRubric', _updateRubric);
