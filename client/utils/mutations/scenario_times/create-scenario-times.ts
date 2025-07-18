// utils/mutations/scenario_times/create-scenario-times.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioTimes(data: (typeof scenarioTimes.$inferInsert)[]) {
  try {
    return await db.insert(scenarioTimes).values(data).returning();
  } catch (error) {
    logError("Error creating multiple scenario_times:", error);
    throw error;
  }
}
