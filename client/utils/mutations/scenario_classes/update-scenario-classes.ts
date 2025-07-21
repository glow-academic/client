// utils/mutations/scenario_classes/update-scenario-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioClasses(ids: string[], data: Partial<typeof scenarioClasses.$inferInsert>) {
  try {
    return await db.update(scenarioClasses).set(data).where(inArray(scenarioClasses.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple scenario_classes:", error);
    throw error;
  }
}
