// utils/mutations/simulation_crowdsourced_messages/delete-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationCrowdsourcedMessage(id: string) {
  try {
    const result = await db.delete(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationCrowdsourcedMessage:", error);
    throw error;
  }
}
