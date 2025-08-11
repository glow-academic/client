// utils/mutations/scenarios/delete-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteScenarios(ids: string[]) {
  try {
    return await db.delete(scenarios).where(inArray(scenarios.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple scenarios:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteScenarios = createMockableAction('deleteScenarios', _deleteScenarios);
