// utils/mutations/simulation_chats/create-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";

export async function createSimulationChats(
  data: (typeof simulationChats.$inferInsert)[],
) {
  try {
    return await db.insert(simulationChats).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_chats:", error);
    throw error;
  }
}
