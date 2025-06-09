// utils/mutations/simulation_chat_standards/update-simulation-chat-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulationChatStandards(ids: string[], data: Partial<typeof simulationChatStandards.$inferInsert>) {
  try {
    return await db.update(simulationChatStandards).set(data).where(inArray(simulationChatStandards.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple simulation_chat_standards:", error);
    throw error;
  }
}
