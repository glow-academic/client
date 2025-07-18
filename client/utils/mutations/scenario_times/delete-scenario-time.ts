// utils/mutations/scenario_times/delete-scenario-time.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioTime(id: string) {
  try {
    const result = await db.delete(scenarioTimes).where(eq(scenarioTimes.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting scenarioTime:", error);
    throw error;
  }
}
