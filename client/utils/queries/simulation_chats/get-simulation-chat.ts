// utils/queries/simulation_chats/get-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChat(id: string) {
  try {
    const result = await db.select().from(simulationChats).where(eq(simulationChats.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationChat:", error);
    throw error;
  }
}
