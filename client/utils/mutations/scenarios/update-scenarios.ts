// utils/mutations/scenarios/update-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateScenarios(ids: string[], data: Partial<typeof scenarios.$inferInsert>) {
  try {
    return await db.update(scenarios).set(data).where(inArray(scenarios.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple scenarios:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateScenarios = createMockableAction('updateScenarios', _updateScenarios);
