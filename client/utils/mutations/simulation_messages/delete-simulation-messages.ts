// utils/mutations/simulation_messages/delete-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationMessages(ids: string[]) {
  try {
    return await db.delete(simulationMessages).where(inArray(simulationMessages.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_messages:", error);
    throw error;
  }
}
