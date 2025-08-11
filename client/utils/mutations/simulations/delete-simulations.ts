// utils/mutations/simulations/delete-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulations(ids: string[]) {
  try {
    return await db.delete(simulations).where(inArray(simulations.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulations:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulations = createMockableAction('deleteSimulations', _deleteSimulations);
