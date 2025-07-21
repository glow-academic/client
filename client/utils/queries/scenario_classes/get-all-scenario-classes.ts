// utils/queries/scenario_classes/get-all-scenario-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllScenarioClasses() {
  try {
    return await db.select().from(scenarioClasses);
  } catch (error) {
    logError("Error fetching all scenario_classes:", error);
    throw error;
  }
}
