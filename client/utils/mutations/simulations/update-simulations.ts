// utils/mutations/simulations/update-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulations(ids: string[], data: Partial<typeof simulations.$inferInsert>) {
  try {
    return await db.update(simulations).set(data).where(inArray(simulations.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple simulations",
      subject: { entityType: "simulations" },
      context: { function: "_updateSimulations", file: "utils/mutations/simulations/update-simulations.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulations = createMockableAction('updateSimulations', _updateSimulations);
