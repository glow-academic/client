// utils/queries/simulation_chats/get-simulation-chats-by-scenarioid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatsByScenarioid(scenarioidId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.scenario_id, scenarioidId));
  } catch (error) {
    console.error("Error fetching simulation_chats by scenarioid:", error);
    throw error;
  }
}
