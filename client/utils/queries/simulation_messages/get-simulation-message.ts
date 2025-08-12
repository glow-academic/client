// utils/queries/simulation_messages/get-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationMessage(id: string) {
  try {
    const result = await db.select().from(simulationMessages).where(eq(simulationMessages.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationMessage",
      subject: { entityType: "simulation_messages", entityId: String(id) },
      context: { function: "_getSimulationMessage", file: "utils/queries/simulation_messages/get-simulation-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationMessage = createMockableAction('getSimulationMessage', _getSimulationMessage);
