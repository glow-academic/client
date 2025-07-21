// utils/mutations/scenario_locations/update-scenario-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioLocations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioLocation(id: string, data: Partial<typeof scenarioLocations.$inferInsert>) {
  try {
    const result = await db.update(scenarioLocations).set(data).where(eq(scenarioLocations.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating scenarioLocation:", error);
    throw error;
  }
}
