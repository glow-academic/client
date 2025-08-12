// utils/queries/model_runs/get-model-runs-by-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByPersonas(personaIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.personaId, personaIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching model_runs by personas",
      subject: { entityType: "model_runs" },
      context: { function: "_getModelRunsByPersonas", file: "utils/queries/model_runs/get-model-runs-by-personas.ts", foreignKey: "personaId", foreignIdsCount: personaIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByPersonas = createMockableAction('getModelRunsByPersonas', _getModelRunsByPersonas);
