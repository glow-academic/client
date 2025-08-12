// utils/queries/simulations/get-all-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulations() {
  try {
    return await db.select().from(simulations);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all simulations",
      subject: { entityType: "simulations" },
      context: { function: "_getAllSimulations", file: "utils/queries/simulations/get-all-simulations.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulations = createMockableAction('getAllSimulations', _getAllSimulations);
