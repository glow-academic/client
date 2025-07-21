// utils/mutations/scenario_classes/delete-scenario-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioClasses(ids: string[]) {
  try {
    return await db.delete(scenarioClasses).where(inArray(scenarioClasses.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple scenario_classes:", error);
    throw error;
  }
}
