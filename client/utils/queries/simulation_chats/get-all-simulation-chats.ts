// utils/queries/simulation_chats/get-all-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationChats() {
  try {
    return await db.select().from(simulationChats);
  } catch (error) {
    logError("Error fetching all simulation_chats:", error);
    throw error;
  }
}
