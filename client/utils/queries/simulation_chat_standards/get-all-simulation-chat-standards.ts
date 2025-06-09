// utils/queries/simulation_chat_standards/get-all-simulation-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";

export async function getAllSimulationChatStandards() {
  try {
    return await db.select().from(simulationChatStandards);
  } catch (error) {
    console.error("Error fetching all simulation_chat_standards:", error);
    throw error;
  }
}
