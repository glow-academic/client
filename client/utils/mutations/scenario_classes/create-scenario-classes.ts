// utils/mutations/scenario_classes/create-scenario-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioClasses(data: (typeof scenarioClasses.$inferInsert)[]) {
  try {
    return await db.insert(scenarioClasses).values(data).returning();
  } catch (error) {
    logError("Error creating multiple scenario_classes:", error);
    throw error;
  }
}
