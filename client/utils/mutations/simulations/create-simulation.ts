// utils/mutations/simulations/create-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulation(data: typeof simulations.$inferInsert) {
  try {
    const result = await db.insert(simulations).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating simulation",
      subject: { entityType: "simulations" },
      context: { function: "_createSimulation", file: "utils/mutations/simulations/create-simulation.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulation = createMockableAction('createSimulation', _createSimulation);
