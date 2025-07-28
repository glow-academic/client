// utils/mutations/simulation_messages/update-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationMessages(ids: string[], data: Partial<typeof simulationMessages.$inferInsert>) {
  try {
    return await db.update(simulationMessages).set(data).where(inArray(simulationMessages.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple simulation_messages:", error);
    throw error;
  }
}
