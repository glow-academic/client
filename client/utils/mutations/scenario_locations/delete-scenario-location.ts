// utils/mutations/scenario_locations/delete-scenario-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioLocation(id: string) {
  try {
    const result = await db.delete(scenarioLocations).where(eq(scenarioLocations.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting scenarioLocation:", error);
    throw error;
  }
}
