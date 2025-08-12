// utils/mutations/simulations/update-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulation(id: string, data: Partial<typeof simulations.$inferInsert>) {
  try {
    const result = await db.update(simulations).set(data).where(eq(simulations.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating simulation",
      subject: { entityType: "simulations", entityId: String(id) },
      context: { function: "_updateSimulation", file: "utils/mutations/simulations/update-simulation.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulation = createMockableAction('updateSimulation', _updateSimulation);
