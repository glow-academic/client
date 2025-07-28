// utils/queries/simulation_chats/get-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChat(id: string) {
  try {
    const result = await db.select().from(simulationChats).where(eq(simulationChats.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationChat:", error);
    throw error;
  }
}
