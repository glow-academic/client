// utils/mutations/scenarios/update-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateScenarios(ids: string[], data: Partial<typeof scenarios.$inferInsert>) {
  try {
    return await db.update(scenarios).set(data).where(inArray(scenarios.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple scenarios",
      subject: { entityType: "scenarios" },
      context: { function: "_updateScenarios", file: "utils/mutations/scenarios/update-scenarios.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateScenarios = createMockableAction('updateScenarios', _updateScenarios);
