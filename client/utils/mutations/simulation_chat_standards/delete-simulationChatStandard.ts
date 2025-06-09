// utils/mutations/simulation_chat_standards/delete-simulationChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationChatStandard(id: string) {
  try {
    const result = await db.delete(simulationChatStandards).where(eq(simulationChatStandards.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationChatStandard:", error);
    throw error;
  }
}
