// utils/queries/simulation_chats/get-simulation-chats-by-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatsByScenarios(scenarioIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.scenarioId, scenarioIds));
  } catch (error) {
    console.error("Error fetching simulation_chats by scenarios:", error);
    throw error;
  }
}
