// utils/mutations/scenario_deadlines/create-scenario-deadlines.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioDeadlines(data: (typeof scenarioDeadlines.$inferInsert)[]) {
  try {
    return await db.insert(scenarioDeadlines).values(data).returning();
  } catch (error) {
    logError("Error creating multiple scenario_deadlines:", error);
    throw error;
  }
}
