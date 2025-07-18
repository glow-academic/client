// utils/queries/scenarios/get-scenarios-by-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenariosByLocations(locationIds: string[]) {
  try {
    return await db.select().from(scenarios).where(inArray(scenarios.locationId, locationIds));
  } catch (error) {
    logError("Error fetching scenarios by locations:", error);
    throw error;
  }
}
