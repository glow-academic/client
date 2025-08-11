// utils/mutations/scenarios/update-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateScenario(id: string, data: Partial<typeof scenarios.$inferInsert>) {
  try {
    const result = await db.update(scenarios).set(data).where(eq(scenarios.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating scenario:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateScenario = createMockableAction('updateScenario', _updateScenario);
