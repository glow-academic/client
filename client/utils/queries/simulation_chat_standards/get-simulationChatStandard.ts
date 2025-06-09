// utils/queries/simulation_chat_standards/get-simulationChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatStandard(id: string) {
  try {
    const result = await db.select().from(simulationChatStandards).where(eq(simulationChatStandards.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationChatStandard:", error);
    throw error;
  }
}
