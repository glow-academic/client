// utils/mutations/scenario_times/update-scenario-times.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioTimes(ids: string[], data: Partial<typeof scenarioTimes.$inferInsert>) {
  try {
    return await db.update(scenarioTimes).set(data).where(inArray(scenarioTimes.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple scenario_times:", error);
    throw error;
  }
}
