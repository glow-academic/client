// utils/mutations/scenarios/update-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateScenarios(ids: string[], data: Partial<typeof scenarios.$inferInsert>) {
  try {
    return await db.update(scenarios).set(data).where(inArray(scenarios.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple scenarios:", error);
    throw error;
  }
}
