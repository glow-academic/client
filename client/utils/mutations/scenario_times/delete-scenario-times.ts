// utils/mutations/scenario_times/delete-scenario-times.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioTimes(ids: string[]) {
  try {
    return await db.delete(scenarioTimes).where(inArray(scenarioTimes.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple scenario_times:", error);
    throw error;
  }
}
