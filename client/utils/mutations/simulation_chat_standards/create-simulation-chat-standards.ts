// utils/mutations/simulation_chat_standards/create-simulation-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";

export async function createSimulationChatStandards(data: (typeof simulationChatStandards.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatStandards).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_chat_standards:", error);
    throw error;
  }
}
