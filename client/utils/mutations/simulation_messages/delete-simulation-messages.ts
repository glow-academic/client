// utils/mutations/simulation_messages/delete-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationMessages(ids: string[]) {
  try {
    return await db.delete(simulationMessages).where(inArray(simulationMessages.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_messages:", error);
    throw error;
  }
}
