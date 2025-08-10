// utils/mutations/simulation_crowdsourced_messages/update-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationCrowdsourcedMessages(ids: string[], data: Partial<typeof simulationCrowdsourcedMessages.$inferInsert>) {
  try {
    return await db.update(simulationCrowdsourcedMessages).set(data).where(inArray(simulationCrowdsourcedMessages.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple simulation_crowdsourced_messages:", error);
    throw error;
  }
}
