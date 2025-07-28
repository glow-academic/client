// utils/mutations/simulation_messages/create-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationMessage(data: typeof simulationMessages.$inferInsert) {
  try {
    const result = await db.insert(simulationMessages).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationMessage:", error);
    throw error;
  }
}
