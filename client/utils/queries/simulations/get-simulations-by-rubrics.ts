// utils/queries/simulations/get-simulations-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(simulations).where(inArray(simulations.rubricId, rubricIds));
  } catch (error) {
    logError("Error fetching simulations by rubrics:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationsByRubrics = createMockableAction('getSimulationsByRubrics', _getSimulationsByRubrics);
