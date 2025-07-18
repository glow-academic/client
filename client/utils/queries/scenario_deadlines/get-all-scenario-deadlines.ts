// utils/queries/scenario_deadlines/get-all-scenario-deadlines.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllScenarioDeadlines() {
  try {
    return await db.select().from(scenarioDeadlines);
  } catch (error) {
    logError("Error fetching all scenario_deadlines:", error);
    throw error;
  }
}
