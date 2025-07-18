// utils/mutations/scenario_times/create-scenario-time.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioTime(data: typeof scenarioTimes.$inferInsert) {
  try {
    const result = await db.insert(scenarioTimes).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating scenarioTime:", error);
    throw error;
  }
}
