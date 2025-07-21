// utils/mutations/scenario_locations/delete-scenario-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioLocations(ids: string[]) {
  try {
    return await db.delete(scenarioLocations).where(inArray(scenarioLocations.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple scenario_locations:", error);
    throw error;
  }
}
