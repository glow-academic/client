// utils/mutations/scenario_classes/delete-scenario-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteScenarioClass(id: string) {
  try {
    const result = await db.delete(scenarioClasses).where(eq(scenarioClasses.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting scenarioClass:", error);
    throw error;
  }
}
