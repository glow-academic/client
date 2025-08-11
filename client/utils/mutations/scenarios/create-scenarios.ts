// utils/mutations/scenarios/create-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createScenarios(data: (typeof scenarios.$inferInsert)[]) {
  try {
    return await db.insert(scenarios).values(data).returning();
  } catch (error) {
    logError("Error creating multiple scenarios:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createScenarios = createMockableAction('createScenarios', _createScenarios);
