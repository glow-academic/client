// utils/queries/simulation_messages/get-simulationMessage.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationMessage(id: string) {
  try {
    const result = await db
      .select()
      .from(simulationMessages)
      .where(eq(simulationMessages.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationMessage:", error);
    throw error;
  }
}
