// utils/mutations/scenarios/update-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenario(
  id: string,
  data: Partial<typeof scenarios.$inferInsert>,
) {
  try {
    const result = await db
      .update(scenarios)
      .set(data)
      .where(eq(scenarios.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating scenario:", error);
    throw error;
  }
}
