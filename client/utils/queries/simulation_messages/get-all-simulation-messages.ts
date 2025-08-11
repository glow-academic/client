// utils/queries/simulation_messages/get-all-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationMessages() {
  try {
    return await db.select().from(simulationMessages);
  } catch (error) {
    logError("Error fetching all simulation_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationMessages = createMockableAction('getAllSimulationMessages', _getAllSimulationMessages);
