// utils/mutations/cohorts/update-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateCohort(id: string, data: Partial<typeof cohorts.$inferInsert>) {
  try {
    const result = await db.update(cohorts).set(data).where(eq(cohorts.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating cohort",
      subject: { entityType: "cohorts", entityId: String(id) },
      context: { function: "_updateCohort", file: "utils/mutations/cohorts/update-cohort.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateCohort = createMockableAction('updateCohort', _updateCohort);
