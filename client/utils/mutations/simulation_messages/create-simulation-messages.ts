// utils/mutations/simulation_messages/create-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";

export async function createSimulationMessages(
  data: (typeof simulationMessages.$inferInsert)[],
) {
  try {
    return await db.insert(simulationMessages).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_messages:", error);
    throw error;
  }
}
