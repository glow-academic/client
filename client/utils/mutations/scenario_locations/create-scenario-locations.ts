// utils/mutations/scenario_locations/create-scenario-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioLocations(data: (typeof scenarioLocations.$inferInsert)[]) {
  try {
    return await db.insert(scenarioLocations).values(data).returning();
  } catch (error) {
    logError("Error creating multiple scenario_locations:", error);
    throw error;
  }
}
