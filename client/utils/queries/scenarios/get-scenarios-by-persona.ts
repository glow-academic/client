// utils/queries/scenarios/get-scenarios-by-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getScenariosByPersona(personaId: string) {
  try {
    return await db.select().from(scenarios).where(eq(scenarios.personaId, personaId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching scenarios by persona",
      subject: { entityType: "scenarios" },
      context: { function: "_getScenariosByPersona", file: "utils/queries/scenarios/get-scenarios-by-persona.ts", foreignKey: "personaId", foreignId: String(personaId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getScenariosByPersona = createMockableAction('getScenariosByPersona', _getScenariosByPersona);
