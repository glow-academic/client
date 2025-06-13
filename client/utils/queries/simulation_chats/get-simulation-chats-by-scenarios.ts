// utils/queries/simulation_chats/get-simulation-chats-by-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatsByScenarios(scenarioIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.scenarioId, scenarioIds));
  } catch (error) {
    logError("Error fetching simulation_chats by scenarios:", error);
    throw error;
  }
}
