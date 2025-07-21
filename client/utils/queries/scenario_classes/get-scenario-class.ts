// utils/queries/scenario_classes/get-scenario-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getScenarioClass(id: string) {
  try {
    const result = await db.select().from(scenarioClasses).where(eq(scenarioClasses.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching scenarioClass:", error);
    throw error;
  }
}
