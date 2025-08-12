// utils/mutations/simulations/create-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulations(data: (typeof simulations.$inferInsert)[]) {
  try {
    return await db.insert(simulations).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulations",
      subject: { entityType: "simulations" },
      context: { function: "_createSimulations", file: "utils/mutations/simulations/create-simulations.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulations = createMockableAction('createSimulations', _createSimulations);
