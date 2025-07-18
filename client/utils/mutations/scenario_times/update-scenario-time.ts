// utils/mutations/scenario_times/update-scenario-time.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioTimes } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioTime(id: string, data: Partial<typeof scenarioTimes.$inferInsert>) {
  try {
    const result = await db.update(scenarioTimes).set(data).where(eq(scenarioTimes.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating scenarioTime:", error);
    throw error;
  }
}
