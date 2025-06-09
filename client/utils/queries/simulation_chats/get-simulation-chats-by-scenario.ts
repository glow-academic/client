// utils/queries/simulation_chats/get-simulation-chats-by-scenario.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatsByScenario(scenarioId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.scenario_id, scenarioId));
  } catch (error) {
    console.error("Error fetching simulation_chats by scenario:", error);
    throw error;
  }
}
