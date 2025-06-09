// utils/queries/simulation_chat_standards/get-simulation-chat-standards-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatStandards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatStandardsByStandards(standardIds: string[]) {
  try {
    return await db.select().from(simulationChatStandards).where(inArray(simulationChatStandards.standardId, standardIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_standards by standards:", error);
    throw error;
  }
}
