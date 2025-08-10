// utils/mutations/simulation_crowdsourced_messages/create-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationCrowdsourcedMessages(data: (typeof simulationCrowdsourcedMessages.$inferInsert)[]) {
  try {
    return await db.insert(simulationCrowdsourcedMessages).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_crowdsourced_messages:", error);
    throw error;
  }
}
