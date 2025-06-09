// utils/mutations/simulation_chat_standards/create-simulationChatStandard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";

export async function createSimulationChatStandard(data: typeof simulationChatStandards.$inferInsert) {
  try {
    const result = await db.insert(simulationChatStandards).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationChatStandard:", error);
    throw error;
  }
}
