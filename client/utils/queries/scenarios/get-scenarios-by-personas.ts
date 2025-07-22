// utils/queries/scenarios/get-scenarios-by-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByPersonas(personaIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.personaId, personaIds));
  } catch (error) {
    logError("Error fetching scenarios by personas:", error);
    throw error;
  }
}
