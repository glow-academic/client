// utils/mutations/cohorts/create-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createCohorts(data: (typeof cohorts.$inferInsert)[]) {
  try {
    return await db.insert(cohorts).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple cohorts",
      subject: { entityType: "cohorts" },
      context: { function: "_createCohorts", file: "utils/mutations/cohorts/create-cohorts.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createCohorts = createMockableAction('createCohorts', _createCohorts);
