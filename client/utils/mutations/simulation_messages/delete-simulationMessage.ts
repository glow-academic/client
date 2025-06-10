// utils/mutations/simulation_messages/delete-simulationMessage.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationMessage(id: string) {
  try {
    const result = await db.delete(simulationMessages).where(eq(simulationMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationMessage:", error);
    throw error;
  }
}
