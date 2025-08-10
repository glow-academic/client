// utils/mutations/simulation_crowdsourced_messages/delete-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationCrowdsourcedMessages(ids: string[]) {
  try {
    return await db.delete(simulationCrowdsourcedMessages).where(inArray(simulationCrowdsourcedMessages.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_crowdsourced_messages:", error);
    throw error;
  }
}
