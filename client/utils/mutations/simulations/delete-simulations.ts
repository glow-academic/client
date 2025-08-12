// utils/mutations/simulations/delete-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulations(ids: string[]) {
  try {
    return await db.delete(simulations).where(inArray(simulations.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple simulations",
      subject: { entityType: "simulations" },
      context: { function: "_deleteSimulations", file: "utils/mutations/simulations/delete-simulations.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulations = createMockableAction('deleteSimulations', _deleteSimulations);
