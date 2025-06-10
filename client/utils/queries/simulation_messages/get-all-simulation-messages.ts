// utils/queries/simulation_messages/get-all-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";

export async function getAllSimulationMessages() {
  try {
    return await db.select().from(simulationMessages);
  } catch (error) {
    console.error("Error fetching all simulation_messages:", error);
    throw error;
  }
}
