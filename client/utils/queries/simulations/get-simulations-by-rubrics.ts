// utils/queries/simulations/get-simulations-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(simulations).where(inArray(simulations.rubricId, rubricIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulations by rubrics",
      subject: { entityType: "simulations" },
      context: { function: "_getSimulationsByRubrics", file: "utils/queries/simulations/get-simulations-by-rubrics.ts", foreignKey: "rubricId", foreignIdsCount: rubricIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationsByRubrics = createMockableAction('getSimulationsByRubrics', _getSimulationsByRubrics);
