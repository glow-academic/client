// utils/mutations/scenario_locations/create-scenario-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioLocation(data: typeof scenarioLocations.$inferInsert) {
  try {
    const result = await db.insert(scenarioLocations).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating scenarioLocation:", error);
    throw error;
  }
}
