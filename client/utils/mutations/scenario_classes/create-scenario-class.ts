// utils/mutations/scenario_classes/create-scenario-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioClass(data: typeof scenarioClasses.$inferInsert) {
  try {
    const result = await db.insert(scenarioClasses).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating scenarioClass:", error);
    throw error;
  }
}
