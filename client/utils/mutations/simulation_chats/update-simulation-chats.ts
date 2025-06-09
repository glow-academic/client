// utils/mutations/simulation_chats/update-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulationChats(ids: string[], data: Partial<typeof simulationChats.$inferInsert>) {
  try {
    return await db.update(simulationChats).set(data).where(inArray(simulationChats.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple simulation_chats:", error);
    throw error;
  }
}
