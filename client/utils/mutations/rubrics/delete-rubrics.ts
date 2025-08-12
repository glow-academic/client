// utils/mutations/rubrics/delete-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteRubrics(ids: string[]) {
  try {
    return await db.delete(rubrics).where(inArray(rubrics.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple rubrics",
      subject: { entityType: "rubrics" },
      context: { function: "_deleteRubrics", file: "utils/mutations/rubrics/delete-rubrics.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteRubrics = createMockableAction('deleteRubrics', _deleteRubrics);
