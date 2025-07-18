// utils/mutations/scenario_deadlines/update-scenario-deadlines.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioDeadlines(ids: string[], data: Partial<typeof scenarioDeadlines.$inferInsert>) {
  try {
    return await db.update(scenarioDeadlines).set(data).where(inArray(scenarioDeadlines.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple scenario_deadlines:", error);
    throw error;
  }
}
