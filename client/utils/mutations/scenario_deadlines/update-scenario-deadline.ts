// utils/mutations/scenario_deadlines/update-scenario-deadline.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioDeadline(id: string, data: Partial<typeof scenarioDeadlines.$inferInsert>) {
  try {
    const result = await db.update(scenarioDeadlines).set(data).where(eq(scenarioDeadlines.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating scenarioDeadline:", error);
    throw error;
  }
}
