// utils/queries/scenario_locations/get-all-scenario-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllScenarioLocations() {
  try {
    return await db.select().from(scenarioLocations);
  } catch (error) {
    logError("Error fetching all scenario_locations:", error);
    throw error;
  }
}
