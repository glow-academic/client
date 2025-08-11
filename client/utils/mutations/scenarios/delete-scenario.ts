// utils/mutations/scenarios/delete-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteScenario(id: string) {
  try {
    const result = await db.delete(scenarios).where(eq(scenarios.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting scenario:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteScenario = createMockableAction('deleteScenario', _deleteScenario);
