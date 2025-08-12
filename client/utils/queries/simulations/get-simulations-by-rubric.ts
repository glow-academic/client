// utils/queries/simulations/get-simulations-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationsByRubric(rubricId: string) {
  try {
    return await db.select().from(simulations).where(eq(simulations.rubricId, rubricId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulations by rubric",
      subject: { entityType: "simulations" },
      context: { function: "_getSimulationsByRubric", file: "utils/queries/simulations/get-simulations-by-rubric.ts", foreignKey: "rubricId", foreignId: String(rubricId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationsByRubric = createMockableAction('getSimulationsByRubric', _getSimulationsByRubric);
