// utils/queries/simulation_crowdsourced_messages/get-all-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationCrowdsourcedMessages() {
  try {
    return await db.select().from(simulationCrowdsourcedMessages);
  } catch (error) {
    logError("Error fetching all simulation_crowdsourced_messages:", error);
    throw error;
  }
}
