// utils/mutations/simulation_messages/create-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";

export async function createSimulationMessage(data: typeof simulationMessages.$inferInsert) {
  try {
    const result = await db.insert(simulationMessages).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationMessage:", error);
    throw error;
  }
}
