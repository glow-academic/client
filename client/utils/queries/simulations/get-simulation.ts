// utils/queries/simulations/get-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulation(id: string) {
  try {
    const result = await db.select().from(simulations).where(eq(simulations.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulation:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulation = createMockableAction('getSimulation', _getSimulation);
