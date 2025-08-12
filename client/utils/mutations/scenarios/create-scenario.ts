// utils/mutations/scenarios/create-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createScenario(data: typeof scenarios.$inferInsert) {
  try {
    const result = await db.insert(scenarios).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating scenario",
      subject: { entityType: "scenarios" },
      context: { function: "_createScenario", file: "utils/mutations/scenarios/create-scenario.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createScenario = createMockableAction('createScenario', _createScenario);
