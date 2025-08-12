// utils/mutations/cohorts/delete-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteCohort(id: string) {
  try {
    const result = await db.delete(cohorts).where(eq(cohorts.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting cohort",
      subject: { entityType: "cohorts", entityId: String(id) },
      context: { function: "_deleteCohort", file: "utils/mutations/cohorts/delete-cohort.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteCohort = createMockableAction('deleteCohort', _deleteCohort);
