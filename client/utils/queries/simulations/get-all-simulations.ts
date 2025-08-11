// utils/queries/simulations/get-all-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulations() {
  try {
    return await db.select().from(simulations);
  } catch (error) {
    logError("Error fetching all simulations:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulations = createMockableAction('getAllSimulations', _getAllSimulations);
