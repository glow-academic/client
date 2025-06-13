// utils/queries/simulation_messages/get-all-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationMessages() {
  try {
    return await db.select().from(simulationMessages);
  } catch (error) {
    logError("Error fetching all simulation_messages:", error);
    throw error;
  }
}
