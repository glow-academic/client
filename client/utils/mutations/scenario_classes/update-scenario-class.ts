// utils/mutations/scenario_classes/update-scenario-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarioClasses } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarioClass(id: string, data: Partial<typeof scenarioClasses.$inferInsert>) {
  try {
    const result = await db.update(scenarioClasses).set(data).where(eq(scenarioClasses.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating scenarioClass:", error);
    throw error;
  }
}
