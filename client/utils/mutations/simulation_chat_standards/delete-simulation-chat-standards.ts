// utils/mutations/simulation_chat_standards/delete-simulation-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationChatStandards(ids: string[]) {
  try {
    return await db.delete(simulationChatStandards).where(inArray(simulationChatStandards.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_chat_standards:", error);
    throw error;
  }
}
