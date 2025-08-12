// utils/queries/scenarios/get-scenarios-by-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getScenariosByPersonas(personaIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.personaId, personaIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching scenarios by personas",
      subject: { entityType: "scenarios" },
      context: { function: "_getScenariosByPersonas", file: "utils/queries/scenarios/get-scenarios-by-personas.ts", foreignKey: "personaId", foreignIdsCount: personaIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getScenariosByPersonas = createMockableAction('getScenariosByPersonas', _getScenariosByPersonas);
