// utils/mutations/scenario_deadlines/delete-scenario-deadline.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioDeadline(id: string) {
  try {
    const result = await db.delete(scenarioDeadlines).where(eq(scenarioDeadlines.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting scenarioDeadline:", error);
    throw error;
  }
}
