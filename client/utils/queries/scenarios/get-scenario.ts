// utils/queries/scenarios/get-scenario.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getScenario(id: string) {
  try {
    const result = await db.select().from(scenarios).where(eq(scenarios.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching scenario",
      subject: { entityType: "scenarios", entityId: String(id) },
      context: { function: "_getScenario", file: "utils/queries/scenarios/get-scenario.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getScenario = createMockableAction('getScenario', _getScenario);
