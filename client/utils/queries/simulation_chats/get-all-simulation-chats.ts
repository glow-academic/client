// utils/queries/simulation_chats/get-all-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";

export async function getAllSimulationChats() {
  try {
    return await db.select().from(simulationChats);
  } catch (error) {
    console.error("Error fetching all simulation_chats:", error);
    throw error;
  }
}
