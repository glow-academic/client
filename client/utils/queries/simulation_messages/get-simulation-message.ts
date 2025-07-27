// utils/queries/simulation_messages/get-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationMessage(id: string) {
  try {
    const result = await db
      .select()
      .from(simulationMessages)
      .where(eq(simulationMessages.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationMessage:", error);
    throw error;
  }
}
