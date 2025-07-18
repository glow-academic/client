// utils/mutations/scenario_deadlines/create-scenario-deadline.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createScenarioDeadline(data: typeof scenarioDeadlines.$inferInsert) {
  try {
    const result = await db.insert(scenarioDeadlines).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating scenarioDeadline:", error);
    throw error;
  }
}
