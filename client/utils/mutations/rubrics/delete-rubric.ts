// utils/mutations/rubrics/delete-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteRubric(id: string) {
  try {
    const result = await db.delete(rubrics).where(eq(rubrics.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting rubric",
      subject: { entityType: "rubrics", entityId: String(id) },
      context: { function: "_deleteRubric", file: "utils/mutations/rubrics/delete-rubric.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteRubric = createMockableAction('deleteRubric', _deleteRubric);
