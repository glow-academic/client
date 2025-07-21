// utils/mutations/scenario_locations/update-scenario-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioLocations(ids: string[], data: Partial<typeof scenarioLocations.$inferInsert>) {
  try {
    return await db.update(scenarioLocations).set(data).where(inArray(scenarioLocations.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple scenario_locations:", error);
    throw error;
  }
}
