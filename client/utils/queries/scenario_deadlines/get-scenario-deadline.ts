// utils/queries/scenario_deadlines/get-scenario-deadline.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioDeadlines } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenarioDeadline(id: string) {
  try {
    const result = await db.select().from(scenarioDeadlines).where(eq(scenarioDeadlines.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching scenarioDeadline:", error);
    throw error;
  }
}
