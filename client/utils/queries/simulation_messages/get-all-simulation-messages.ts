// utils/queries/simulation_messages/get-all-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationMessages() {
  try {
    return await db.select().from(simulationMessages);
  } catch (error) {
    logError("Error fetching all simulation_messages:", error);
    throw error;
  }
}
