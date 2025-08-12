// utils/queries/scenarios/get-all-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllScenarios() {
  try {
    return await db.select().from(scenarios);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all scenarios",
      subject: { entityType: "scenarios" },
      context: { function: "_getAllScenarios", file: "utils/queries/scenarios/get-all-scenarios.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllScenarios = createMockableAction('getAllScenarios', _getAllScenarios);
