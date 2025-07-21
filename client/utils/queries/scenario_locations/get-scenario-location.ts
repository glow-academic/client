// utils/queries/scenario_locations/get-scenario-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenarioLocation(id: string) {
  try {
    const result = await db.select().from(scenarioLocations).where(eq(scenarioLocations.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching scenarioLocation:", error);
    throw error;
  }
}
