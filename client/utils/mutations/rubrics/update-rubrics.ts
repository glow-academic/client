// utils/mutations/rubrics/update-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateRubrics(ids: string[], data: Partial<typeof rubrics.$inferInsert>) {
  try {
    return await db.update(rubrics).set(data).where(inArray(rubrics.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple rubrics",
      subject: { entityType: "rubrics" },
      context: { function: "_updateRubrics", file: "utils/mutations/rubrics/update-rubrics.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateRubrics = createMockableAction('updateRubrics', _updateRubrics);
