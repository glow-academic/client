// utils/mutations/scenarios/create-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createScenarios(data: (typeof scenarios.$inferInsert)[]) {
  try {
    return await db.insert(scenarios).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple scenarios",
      subject: { entityType: "scenarios" },
      context: { function: "_createScenarios", file: "utils/mutations/scenarios/create-scenarios.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createScenarios = createMockableAction('createScenarios', _createScenarios);
