// utils/queries/scenario_times/get-all-scenario-times.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllScenarioTimes() {
  try {
    return await db.select().from(scenarioTimes);
  } catch (error) {
    logError("Error fetching all scenario_times:", error);
    throw error;
  }
}
