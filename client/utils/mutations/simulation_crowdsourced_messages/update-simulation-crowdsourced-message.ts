// utils/mutations/simulation_crowdsourced_messages/update-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationCrowdsourcedMessage(id: string, data: Partial<typeof simulationCrowdsourcedMessages.$inferInsert>) {
  try {
    const result = await db.update(simulationCrowdsourcedMessages).set(data).where(eq(simulationCrowdsourcedMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationCrowdsourcedMessage:", error);
    throw error;
  }
}
