// utils/mutations/simulation_messages/update-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationMessage(id: string, data: Partial<typeof simulationMessages.$inferInsert>) {
  try {
    const result = await db.update(simulationMessages).set(data).where(eq(simulationMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationMessage:", error);
    throw error;
  }
}
