// utils/mutations/scenario_deadlines/delete-scenario-deadlines.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioDeadlines(ids: string[]) {
  try {
    return await db.delete(scenarioDeadlines).where(inArray(scenarioDeadlines.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple scenario_deadlines:", error);
    throw error;
  }
}
