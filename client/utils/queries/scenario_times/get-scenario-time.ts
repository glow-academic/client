// utils/queries/scenario_times/get-scenario-time.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenarioTime(id: string) {
  try {
    const result = await db.select().from(scenarioTimes).where(eq(scenarioTimes.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching scenarioTime:", error);
    throw error;
  }
}
