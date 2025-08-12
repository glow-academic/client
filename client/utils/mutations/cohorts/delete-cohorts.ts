// utils/mutations/cohorts/delete-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteCohorts(ids: string[]) {
  try {
    return await db.delete(cohorts).where(inArray(cohorts.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple cohorts",
      subject: { entityType: "cohorts" },
      context: { function: "_deleteCohorts", file: "utils/mutations/cohorts/delete-cohorts.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteCohorts = createMockableAction('deleteCohorts', _deleteCohorts);
