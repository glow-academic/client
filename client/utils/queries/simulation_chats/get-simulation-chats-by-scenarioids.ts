// utils/queries/simulation_chats/get-simulation-chats-by-scenarioids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatsByScenarioids(scenarioidIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.scenario_id, scenarioidIds));
  } catch (error) {
    console.error("Error fetching simulation_chats by scenarioids:", error);
    throw error;
  }
}
