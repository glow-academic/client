// utils/queries/simulation_chats/get-all-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationChats() {
  try {
    return await db.select().from(simulationChats);
  } catch (error) {
    logError("Error fetching all simulation_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationChats = createMockableAction('getAllSimulationChats', _getAllSimulationChats);
