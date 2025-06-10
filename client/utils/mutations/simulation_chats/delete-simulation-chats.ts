// utils/mutations/simulation_chats/delete-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationChats(ids: string[]) {
  try {
    return await db.delete(simulationChats).where(inArray(simulationChats.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_chats:", error);
    throw error;
  }
}
